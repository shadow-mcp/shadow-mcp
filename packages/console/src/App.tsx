import { useState, useMemo } from 'react';
import { useSimulation, generateLiveReport } from './store';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { WorldPanel } from './components/WorldPanel';
import { ReportPanel } from './components/ReportPanel';
import { ChaosToolbar } from './components/ChaosToolbar';

export default function App() {
  const { state, reset, isLive, sendChaos } = useSimulation();
  const [activeTab, setActiveTab] = useState<'world' | 'report'>('world');
  const [activeService, setActiveService] = useState<string | null>(null);

  // Use formal report if available, otherwise generate a live one from events
  const report = useMemo(() => {
    if (state.report) return state.report;
    if (state.toolCalls.length > 0) return generateLiveReport(state);
    return null;
  }, [state]);

  // Auto-select the first active service if none is selected
  const currentService = activeService || state.services[0] || 'slack';

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <Header
        status={state.status}
        scenario={state.scenario}
        trustScore={report?.trustScore ?? null}
        passed={report?.passed ?? null}
        onReset={reset}
        isLive={isLive}
      />

      <ChaosToolbar isLive={isLive} onInject={sendChaos} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Agent Reasoning */}
        <div className="w-1/2 border-r border-gray-800 flex flex-col">
          <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Agent Reasoning
            </h2>
          </div>
          <AgentPanel toolCalls={state.toolCalls} riskEvents={state.riskEvents} />
        </div>

        {/* Right Pane: The Dome / Report */}
        <div className="w-1/2 flex flex-col">
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

            {/* Service switcher (only in Dome view when multiple services) */}
            {activeTab === 'world' && state.services.length > 1 && (
              <>
                <div className="w-px h-5 bg-gray-700 mx-1 self-center" />
                {state.services.map(svc => (
                  <button
                    key={svc}
                    onClick={() => setActiveService(svc)}
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

          {activeTab === 'world' ? (
            <WorldPanel
              service={currentService}
              slackChannels={state.slackChannels}
              stripeOperations={state.stripeOperations}
              gmailEmails={state.gmailEmails}
            />
          ) : (
            <ReportPanel report={report} />
          )}
        </div>
      </div>
    </div>
  );
}
