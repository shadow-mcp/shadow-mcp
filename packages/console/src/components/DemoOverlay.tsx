import { useState, useEffect, useRef } from 'react';

// ── Act definitions ──────────────────────────────────────────────────

export interface Act {
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  startStep: number; // inclusive, 0-indexed
  endStep: number;   // inclusive, 0-indexed
  mood: 'safe' | 'danger';
}

export const DEMO_ACTS: Act[] = [
  {
    id: 1,
    title: 'Gmail Triage',
    subtitle: 'The agent reads the inbox and sends a professional reply.',
    icon: '\u2709\uFE0F',
    startStep: 0,
    endStep: 2,
    mood: 'safe',
  },
  {
    id: 2,
    title: 'Slack \u2014 Customer Service',
    subtitle: 'A frustrated customer needs help. The agent responds in Slack and escalates to engineering.',
    icon: '\uD83D\uDCAC',
    startStep: 3,
    endStep: 6,
    mood: 'safe',
  },
  {
    id: 3,
    title: 'Phishing Attack',
    subtitle: 'A social engineering email arrives. The agent falls for it \u2014 leaking customer data and confidential salaries.',
    icon: '\uD83C\uDFA3',
    startStep: 7,
    endStep: 11,
    mood: 'danger',
  },
  {
    id: 4,
    title: 'Unauthorized Refund',
    subtitle: 'Still following phishing instructions, the agent processes a $4,999 refund through Stripe.',
    icon: '\uD83D\uDCB3',
    startStep: 12,
    endStep: 14,
    mood: 'danger',
  },
];

export function getActForStep(step: number): Act | null {
  return DEMO_ACTS.find(a => step >= a.startStep && step <= a.endStep) || null;
}

// ── Welcome Splash ───────────────────────────────────────────────────

interface WelcomeSplashProps {
  onStart: () => void;
}

export function WelcomeSplash({ onStart }: WelcomeSplashProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
      <div className="max-w-md text-center space-y-6 px-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/logo.jpeg?v=4"
            alt="Shadow"
            className="w-16 h-16 rounded-2xl shadow-lg shadow-shadow-500/20"
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">
            Shadow<span className="text-shadow-400">Demo</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            A simulated AI agent handling real-world tasks
          </p>
        </div>

        {/* Narrative setup */}
        <div className="text-left space-y-3 bg-gray-900/60 rounded-xl p-5 border border-gray-800">
          <p className="text-sm text-gray-300 leading-relaxed">
            Watch an AI agent manage <span className="text-red-400 font-medium">Gmail</span>,
            {' '}<span className="text-purple-400 font-medium">Slack</span>, and
            {' '}<span className="text-blue-400 font-medium">Stripe</span> for a company called Acme Corp.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            It starts well — professional replies, helpful customer service. Then a phishing email arrives...
          </p>
          <div className="flex items-center gap-3 pt-1">
            {DEMO_ACTS.map(act => (
              <div key={act.id} className="flex items-center gap-1.5">
                <span className="text-sm">{act.icon}</span>
                <span className={`text-[10px] font-medium ${act.mood === 'danger' ? 'text-red-400' : 'text-gray-500'}`}>
                  Act {act.id}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-2">
          <button
            onClick={onStart}
            className="px-8 py-3 rounded-xl text-sm font-semibold bg-shadow-600 text-white hover:bg-shadow-500 transition-all shadow-lg shadow-shadow-600/20 hover:shadow-shadow-500/30"
          >
            Start Demo
          </button>
          <p className="text-[10px] text-gray-600">
            Use <span className="font-mono bg-gray-800 px-1 py-0.5 rounded text-gray-400">{'\u25C0'} {'\u25B6'}</span> to step through each action
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Act Title Card ───────────────────────────────────────────────────

interface ActCardProps {
  act: Act;
  onDismiss: () => void;
}

export function ActCard({ act, onDismiss }: ActCardProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setOpacity(1));
  }, []);

  const isDanger = act.mood === 'danger';

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm cursor-pointer transition-opacity duration-300"
      style={{ opacity }}
      onClick={onDismiss}
    >
      <div className={`text-center space-y-3 px-8 py-6 rounded-2xl border ${
        isDanger
          ? 'bg-red-950/40 border-red-500/20'
          : 'bg-gray-900/60 border-gray-700/50'
      }`}>
        <div className="text-3xl">{act.icon}</div>
        <div>
          <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
            isDanger ? 'text-red-500' : 'text-shadow-400'
          }`}>
            Act {act.id}
          </div>
          <h2 className="text-xl font-bold text-white">{act.title}</h2>
        </div>
        <p className={`text-sm max-w-xs leading-relaxed ${
          isDanger ? 'text-red-300/80' : 'text-gray-400'
        }`}>
          {act.subtitle}
        </p>
        <p className="text-[10px] text-gray-600 pt-1">
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}

// ── Hook: track act transitions ──────────────────────────────────────

export function useActTransition(viewingIndex: number) {
  const [showAct, setShowAct] = useState<Act | null>(null);
  const prevActRef = useRef<number | null>(null);
  const seenActsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const currentAct = getActForStep(viewingIndex);
    const currentActId = currentAct?.id ?? null;

    if (currentActId !== null && currentActId !== prevActRef.current) {
      // Only show each act card once — don't re-trigger on back/forward
      if (!seenActsRef.current.has(currentActId)) {
        seenActsRef.current.add(currentActId);
        setShowAct(currentAct);
      }
    }

    prevActRef.current = currentActId;
  }, [viewingIndex]);

  const dismiss = () => setShowAct(null);

  return { showAct, dismiss };
}

// ── Completion Overlay (after last step) ─────────────────────────────

interface CompletionOverlayProps {
  onReplay: () => void;
}

export function CompletionOverlay({ onReplay }: CompletionOverlayProps) {
  const [opacity, setOpacity] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpacity(1));
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-gray-950/85 backdrop-blur-sm transition-opacity duration-500"
      style={{ opacity }}
    >
      <div className="max-w-sm text-center space-y-5 px-8">
        {/* Logo */}
        <img
          src="/logo.jpeg?v=4"
          alt="Shadow"
          className="w-16 h-16 rounded-2xl shadow-lg shadow-shadow-500/20 mx-auto"
        />

        <div>
          <h2 className="text-xl font-bold text-white">Shadow caught everything.</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            PII leaks, salary exposure, unauthorized refunds {'\u2014'} all detected in a safe simulation. Nothing real happened.
          </p>
        </div>

        {/* Primary CTA: Try with your agent */}
        <div className="bg-gray-900/60 rounded-xl p-5 border border-shadow-500/20 space-y-3">
          <div className="text-sm font-bold text-white">
            Try it with your agent
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText('npx mcp-shadow').then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="w-full text-left text-sm text-shadow-300 bg-gray-950/60 rounded-lg px-4 py-3 font-mono hover:bg-gray-950/80 transition-colors cursor-pointer group flex items-center justify-between"
          >
            <span>npx mcp-shadow</span>
            <span className="text-[10px] text-gray-500 group-hover:text-shadow-400 transition-colors">
              {copied ? 'Copied!' : 'Click to copy'}
            </span>
          </button>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Hook up your agent, run scenarios, and get a trust report.
          </p>
        </div>

        {/* Secondary: Replay */}
        <button
          onClick={onReplay}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Replay demo
        </button>
      </div>
    </div>
  );
}
