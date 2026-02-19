import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSimulation, generateLiveReport } from './store';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { WorldPanel } from './components/WorldPanel';
import { ReportPanel } from './components/ReportPanel';
import { NarrationBar } from './components/NarrationBar';
import { ChaosToolbar } from './components/ChaosToolbar';
import { WelcomeSplash, ActCard, CompletionOverlay, useActTransition } from './components/DemoOverlay';

export default function App() {
  const { state, reset, isLive, sendChaos, sendInjectMessage, sendInjectEmail, sendInjectStripeEvent } = useSimulation();
  const [activeTab, setActiveTab] = useState<'world' | 'report'>('world');
  const [activeService, setActiveService] = useState<string | null>(null);

  // Welcome splash — shows once on first load
  const [showWelcome, setShowWelcome] = useState(true);

  // Step-through controls: viewingIndex tracks which tool call is shown
  const [viewingIndex, setViewingIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // Act transition overlays
  const { showAct, dismiss: dismissAct } = useActTransition(viewingIndex);

  // Completion overlay — shows when user steps past the last tool call
  const [showCompletion, setShowCompletion] = useState(false);

  // Auto-advance viewingIndex when new tool calls arrive (if auto-play is on)
  const prevToolCountRef = useRef(state.toolCalls.length);
  useEffect(() => {
    if (state.toolCalls.length > prevToolCountRef.current) {
      if (isAutoPlay) {
        setViewingIndex(state.toolCalls.length - 1);
      }
    }
    prevToolCountRef.current = state.toolCalls.length;
  }, [state.toolCalls.length, isAutoPlay]);

  // Reset viewingIndex on simulation reset
  useEffect(() => {
    if (state.toolCalls.length === 0) {
      setViewingIndex(0);
    }
  }, [state.toolCalls.length]);

  // Step handlers
  const handlePrev = useCallback(() => {
    setIsAutoPlay(false);
    setViewingIndex(i => Math.max(0, i - 1));
  }, []);
  const handleNext = useCallback(() => {
    setViewingIndex(i => {
      if (i >= state.toolCalls.length - 1) {
        // Already at the end — show completion overlay
        setShowCompletion(true);
        return i;
      }
      return i + 1;
    });
  }, [state.toolCalls.length]);
  const handleToggleAutoPlay = useCallback(() => {
    setIsAutoPlay(prev => {
      if (!prev) {
        // Jumping to live — go to latest
        setViewingIndex(state.toolCalls.length - 1);
      }
      return !prev;
    });
  }, [state.toolCalls.length]);

  // Auto-switch override: pauses auto-switch when user interacts with the Dome
  const userOverrideRef = useRef(false);
  const overrideTimerRef = useRef<number | null>(null);

  const pauseAutoSwitch = useCallback(() => {
    userOverrideRef.current = true;
    if (overrideTimerRef.current) clearTimeout(overrideTimerRef.current);
    overrideTimerRef.current = window.setTimeout(() => {
      userOverrideRef.current = false;
    }, 15000);
  }, []);

  // Auto-select the first active service if none is selected
  // Preferred tab order: gmail first (primary use case), then slack, stripe
  const SERVICE_ORDER = ['gmail', 'slack', 'stripe'];
  const sortedServices = [...state.services].sort(
    (a, b) => (SERVICE_ORDER.indexOf(a) ?? 99) - (SERVICE_ORDER.indexOf(b) ?? 99)
  );
  const currentService = activeService || sortedServices[0] || 'gmail';

  // Tool call at the current viewing index (for deep navigation)
  const viewingToolCall = state.toolCalls.length > 0 ? state.toolCalls[viewingIndex] || state.toolCalls[state.toolCalls.length - 1] : null;

  // Timestamp-based filtering: only show data that existed at the current step
  // Use the NEXT tool call's timestamp as cutoff so data created by the current step is visible
  const nextToolCall = state.toolCalls[viewingIndex + 1] || null;
  const cutoffTimestamp = nextToolCall ? nextToolCall.timestamp - 1 : Infinity;

  // Generate report from events visible at the current step (so trust score changes as you step through)
  const report = useMemo(() => {
    if (state.toolCalls.length === 0) return null;
    const visibleToolCalls = state.toolCalls.slice(0, viewingIndex + 1);
    const visibleRiskEvents = state.riskEvents.filter(e => e.timestamp <= cutoffTimestamp);
    const filteredState = { ...state, toolCalls: visibleToolCalls, riskEvents: visibleRiskEvents };
    return generateLiveReport(filteredState);
  }, [state, viewingIndex, cutoffTimestamp]);

  const visibleEmails = useMemo(() =>
    state.gmailEmails.filter(e => e.timestamp <= cutoffTimestamp),
    [state.gmailEmails, cutoffTimestamp]
  );
  const visibleChannels = useMemo(() =>
    state.slackChannels.map(ch => ({
      ...ch,
      messages: ch.messages.filter(m => m.timestamp <= cutoffTimestamp),
    })),
    [state.slackChannels, cutoffTimestamp]
  );
  const visibleOperations = useMemo(() =>
    state.stripeOperations.filter(op => op.timestamp <= cutoffTimestamp),
    [state.stripeOperations, cutoffTimestamp]
  );

  // Auto-switch service tab to follow the viewed tool call
  useEffect(() => {
    if (userOverrideRef.current) return;
    if (!viewingToolCall) return;
    const tcService = viewingToolCall.service;
    if (tcService) {
      if (tcService !== currentService) {
        setActiveService(tcService);
      }
      setActiveTab('world');
    }
  }, [viewingIndex, viewingToolCall?.service]);

  // Service tab click — pauses auto-switch
  const handleServiceClick = (svc: string) => {
    setActiveService(svc);
    setActiveTab('world');
    pauseAutoSwitch();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden relative">
      {/* Welcome splash — full-page overlay */}
      {showWelcome && state.toolCalls.length > 0 && (
        <WelcomeSplash onStart={() => setShowWelcome(false)} />
      )}

      <Header
        status={state.status}
        scenario={state.scenario}
        trustScore={report?.trustScore ?? null}
        passed={report?.passed ?? null}
        onReset={reset}
        isLive={isLive}
        onTrustClick={() => setActiveTab('report')}
      />

      <ChaosToolbar isLive={isLive} onInject={sendChaos} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Agent Reasoning */}
        <div className="w-2/5 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Agent Reasoning
            </h2>
          </div>
          <AgentPanel toolCalls={state.toolCalls} riskEvents={state.riskEvents} viewingIndex={viewingIndex} />
        </div>

        {/* Right Pane: The Dome / Report */}
        <div className="w-3/5 flex flex-col relative">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50 flex gap-1">
            <button
              onClick={() => setActiveTab('world')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                activeTab === 'world'
                  ? 'bg-shadow-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              The Dome
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                activeTab === 'report'
                  ? 'bg-shadow-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              Shadow Report
            </button>

            {/* Service switcher — always visible when multiple services */}
            {state.services.length > 1 && (
              <>
                <div className="w-px h-5 bg-gray-700 mx-1 self-center" />
                {sortedServices.map(svc => (
                  <button
                    key={svc}
                    onClick={() => handleServiceClick(svc)}
                    className={`px-2 py-1 text-xs font-medium rounded transition-colors capitalize ${
                      currentService === svc
                        ? svc === 'slack' ? 'bg-purple-500/20 text-purple-300'
                        : svc === 'stripe' ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-red-500/20 text-red-300'
                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {svc}
                  </button>
                ))}
              </>
            )}
          </div>

          <NarrationBar
            toolCalls={state.toolCalls}
            riskEvents={state.riskEvents}
            viewingIndex={viewingIndex}
            isAutoPlay={isAutoPlay}
            onPrev={handlePrev}
            onNext={handleNext}
            onToggleAutoPlay={handleToggleAutoPlay}
          />

          {/* Act title card overlay */}
          {showAct && !showWelcome && !isAutoPlay && (
            <ActCard act={showAct} onDismiss={dismissAct} />
          )}

          {/* Completion overlay — after last step */}
          {showCompletion && (
            <CompletionOverlay
              onReplay={() => { setShowCompletion(false); setShowWelcome(true); setViewingIndex(0); setIsAutoPlay(false); }}
            />
          )}

          {activeTab === 'world' ? (
            <WorldPanel
              service={currentService}
              slackChannels={visibleChannels}
              stripeOperations={visibleOperations}
              gmailEmails={visibleEmails}
              onSendMessage={sendInjectMessage}
              onSendEmail={sendInjectEmail}
              onSendStripeEvent={sendInjectStripeEvent}
              isLive={isLive}
              onUserInteraction={pauseAutoSwitch}
              lastToolCall={viewingToolCall}
              toolCallCount={viewingIndex}
            />
          ) : (
            <ReportPanel report={report} toolCalls={state.toolCalls} riskEvents={state.riskEvents} />
          )}
        </div>
      </div>
    </div>
  );
}
