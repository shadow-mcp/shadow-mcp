import { useState, useRef, useEffect } from 'react';
import type { SlackChannel, StripeOperation, GmailEmail, ToolCall } from '../types';

interface WorldPanelProps {
  service: string;
  slackChannels: SlackChannel[];
  stripeOperations: StripeOperation[];
  gmailEmails: GmailEmail[];
  onSendMessage?: (channel: string, userName: string, text: string) => void;
  onSendEmail?: (fromName: string, fromEmail: string, subject: string, body: string) => void;
  onSendStripeEvent?: (eventType: string, chargeId?: string, customerId?: string, amount?: number, reason?: string) => void;
  isLive?: boolean;
  onUserInteraction?: () => void;
  lastToolCall?: ToolCall | null;
  toolCallCount?: number;
}

export function WorldPanel({ service, slackChannels, stripeOperations, gmailEmails, onSendMessage, onSendEmail, onSendStripeEvent, isLive, onUserInteraction, lastToolCall, toolCallCount }: WorldPanelProps) {
  if (service === 'slack') return <SlackWorld channels={slackChannels} onSendMessage={onSendMessage} isLive={isLive} onUserInteraction={onUserInteraction} lastToolCall={lastToolCall} toolCallCount={toolCallCount} />;
  if (service === 'stripe') return <StripeWorld operations={stripeOperations} onSendStripeEvent={onSendStripeEvent} isLive={isLive} onUserInteraction={onUserInteraction} lastToolCall={lastToolCall} toolCallCount={toolCallCount} />;
  if (service === 'gmail') return <GmailWorld emails={gmailEmails} onSendEmail={onSendEmail} isLive={isLive} onUserInteraction={onUserInteraction} lastToolCall={lastToolCall} toolCallCount={toolCallCount} />;
  return <div className="flex-1 flex items-center justify-center text-gray-600">Waiting for agent activity...</div>;
}

// ── Simulated Slack UI ─────────────────────────────────────────────────

const PERSONAS = [
  'Support Manager',
  'Dave (Angry Client)',
  'Karen (VIP Customer)',
  'CEO',
  'System Admin',
  'New Employee',
];

function SlackWorld({ channels, onSendMessage, isLive, onUserInteraction, lastToolCall, toolCallCount }: {
  channels: SlackChannel[];
  onSendMessage?: (channel: string, userName: string, text: string) => void;
  isLive?: boolean;
  onUserInteraction?: () => void;
  lastToolCall?: ToolCall | null;
  toolCallCount?: number;
}) {
  const [activeChannel, setActiveChannel] = useState(channels[1]?.name || channels[0]?.name || '');
  const [message, setMessage] = useState('');
  const [persona, setPersona] = useState('Dave (Angry Client)');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = channels.find(c => c.name === activeChannel) || channels[0];

  // Auto-navigate to the channel the agent is acting on
  useEffect(() => {
    if (!lastToolCall || lastToolCall.service !== 'slack') return;
    const channel = String(lastToolCall.arguments?.channel || '');
    if (channel && ['post_message', 'get_channel_history', 'incoming_message'].includes(lastToolCall.tool_name)) {
      setActiveChannel(channel);
    } else if (lastToolCall.tool_name === 'send_direct_message') {
      const user = String(lastToolCall.arguments?.user || 'unknown');
      setActiveChannel(`DM: ${user}`);
    } else if (lastToolCall.tool_name === 'list_channels' && channels.length > 0) {
      // Show #clients if available (most common use case), else first channel
      const clients = channels.find(c => c.name === 'clients');
      setActiveChannel(clients ? 'clients' : channels[0].name);
    }
  }, [toolCallCount, lastToolCall]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length]);

  const handleSend = () => {
    if (!message.trim() || !onSendMessage || !active) return;
    onSendMessage(active.name, persona, message.trim());
    setMessage('');
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 bg-[#1a1d21] border-r border-gray-800 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-800">
          <div className="font-semibold text-sm text-white">Acme Corp</div>
          <div className="text-[10px] text-green-400 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Shadow Simulation
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Channels
          </div>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setActiveChannel(ch.name); onUserInteraction?.(); }}
              className={`w-full px-3 py-1 text-left text-sm flex items-center gap-1.5 transition-colors ${
                activeChannel === ch.name
                  ? 'bg-[#1164a3] text-white'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="text-gray-500">{ch.name.startsWith('DM:') ? '@' : '#'}</span>
              <span className="truncate">{ch.name}</span>
              {ch.messages.some(m => m.is_agent) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#1a1d21]">
        {active ? (
          <>
            <div className="px-4 py-2.5 border-b border-gray-800 flex items-center gap-2">
              <span className="text-gray-500 font-bold">{active.name.startsWith('DM:') ? '@' : '#'}</span>
              <span className="font-semibold text-sm text-white">{active.name}</span>
              {active.name === 'clients' && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/10 text-orange-400 font-medium">
                  External
                </span>
              )}
              <span className="text-[10px] text-gray-600 ml-auto">{active.messages.length} messages</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {active.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 fade-in ${msg.is_agent ? 'slide-in-right' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.is_agent
                      ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {(msg.user_name || '?')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${msg.is_agent ? 'text-blue-400' : 'text-white'}`}>
                        {msg.user_name}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.is_agent && (
                        <span className="px-1 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 font-medium">
                          AGENT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 mt-0.5 leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ShadowPlay: chat input for interactive testing */}
            {isLive && onSendMessage && (
              <div className="px-4 py-3 border-t border-gray-800 bg-[#222529]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-shadow-400 font-semibold uppercase tracking-wider">ShadowPlay</span>
                  <span className="text-[10px] text-gray-600">Inject a message as:</span>
                  <select
                    value={persona}
                    onChange={e => setPersona(e.target.value)}
                    className="text-xs bg-gray-800 text-gray-300 rounded px-2 py-1 border border-gray-700 outline-none focus:border-shadow-500 w-44"
                  >
                    {PERSONAS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Type as ${persona}...`}
                    className="flex-1 bg-gray-800 text-sm text-gray-200 rounded-lg px-3 py-2 border border-gray-700 outline-none focus:border-shadow-500 placeholder-gray-600"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-shadow-600 text-white hover:bg-shadow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
            No channels yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── Simulated Stripe Dashboard ─────────────────────────────────────────

const STRIPE_NAV = ['All', 'Payments', 'Customers', 'Disputes'] as const;

function stripeTypeForNav(nav: string): string | null {
  if (nav === 'Payments') return 'charge';
  if (nav === 'Customers') return 'customer';
  if (nav === 'Disputes') return 'dispute';
  return null;
}

function stripeStatusIcon(op: StripeOperation) {
  if (op.type === 'refund') return '\u21BA';
  if (op.type === 'dispute') return '\u26A0';
  if (op.type === 'customer') return '\u25CF';
  if (op.data.status === 'failed') return '\u2717';
  return '\u2713';
}

function stripeStatusColor(op: StripeOperation) {
  if (op.type === 'refund') return 'text-orange-400 bg-orange-400/10';
  if (op.type === 'dispute') return 'text-red-400 bg-red-400/10';
  if (op.type === 'customer') return 'text-blue-400 bg-blue-400/10';
  if (op.data.status === 'failed') return 'text-red-400 bg-red-400/10';
  return 'text-green-400 bg-green-400/10';
}

function stripeStatusLabel(op: StripeOperation) {
  if (op.type === 'refund') return 'Refunded';
  if (op.type === 'dispute') return 'Dispute';
  if (op.type === 'customer') return 'Customer';
  if (op.data.status === 'failed') return 'Failed';
  if (op.data.status === 'succeeded') return 'Succeeded';
  return String(op.data.status || op.type);
}

function formatDollars(cents: number): string {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StripeWorld({ operations, onSendStripeEvent, isLive, onUserInteraction, lastToolCall, toolCallCount }: {
  operations: StripeOperation[];
  onSendStripeEvent?: (eventType: string, chargeId?: string, customerId?: string, amount?: number, reason?: string) => void;
  isLive?: boolean;
  onUserInteraction?: () => void;
  lastToolCall?: ToolCall | null;
  toolCallCount?: number;
}) {
  const [activeNav, setActiveNav] = useState<string>('All');
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const [eventType, setEventType] = useState('dispute_created');
  const [selectedCharge, setSelectedCharge] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reason, setReason] = useState('fraudulent');
  const [failAmount, setFailAmount] = useState('50.00');

  const charges = operations.filter(op => op.type === 'charge' && op.data.status !== 'failed');
  const customers = operations.filter(op => op.type === 'customer');

  // Step-based navigation: expand the operation matching the current step's tool call
  useEffect(() => {
    if (!lastToolCall || lastToolCall.service !== 'stripe') return;
    const opType = lastToolCall.tool_name.replace('create_', '');
    if (['charge', 'refund', 'customer', 'dispute'].includes(opType)) {
      // Find the matching operation by looking at response id
      const responseId = (lastToolCall.response as Record<string, unknown>)?.id
        || ((lastToolCall.response as Record<string, unknown>)?.content as Array<{ text: string }>)?.[0]?.text;
      let parsedId: string | undefined;
      if (responseId && typeof responseId === 'string' && !responseId.startsWith('{')) {
        parsedId = responseId;
      } else if (typeof responseId === 'string') {
        try { parsedId = JSON.parse(responseId).id; } catch { /* ignore */ }
      }
      if (parsedId) {
        setExpandedOp(parsedId);
        // Switch nav to relevant section
        if (opType === 'charge' || opType === 'refund') setActiveNav('Payments');
        else if (opType === 'customer') setActiveNav('Customers');
        else if (opType === 'dispute') setActiveNav('Disputes');
      }
    } else if (lastToolCall.tool_name === 'list_charges') {
      setActiveNav('Payments');
    } else if (lastToolCall.tool_name === 'list_customers') {
      setActiveNav('Customers');
    }
  }, [toolCallCount, lastToolCall]);

  // Counts per nav
  const navCounts: Record<string, number> = {
    All: operations.length,
    Payments: operations.filter(op => op.type === 'charge').length,
    Customers: operations.filter(op => op.type === 'customer').length,
    Disputes: operations.filter(op => op.type === 'dispute').length,
  };

  // Balance = succeeded charges - refunds
  const totalCharged = operations
    .filter(op => op.type === 'charge' && op.data.status === 'succeeded')
    .reduce((sum, op) => sum + (Number(op.data.amount) || 0), 0);
  const totalRefunded = operations
    .filter(op => op.type === 'refund')
    .reduce((sum, op) => sum + (Number(op.data.amount) || 0), 0);
  const totalDisputed = operations
    .filter(op => op.type === 'dispute')
    .reduce((sum, op) => sum + (Number(op.data.amount) || 0), 0);
  const balance = totalCharged - totalRefunded - totalDisputed;
  const disputeCount = navCounts.Disputes;

  // Filtered operations
  const filterType = stripeTypeForNav(activeNav);
  const filtered = filterType
    ? operations.filter(op => op.type === filterType)
    : operations;
  const sorted = [...filtered].reverse(); // newest first

  const handleInject = () => {
    if (!onSendStripeEvent) return;
    if (eventType === 'dispute_created') {
      if (!selectedCharge) return;
      onSendStripeEvent('dispute_created', selectedCharge, undefined, undefined, reason);
    } else {
      if (!selectedCustomer) return;
      const amountCents = Math.round(parseFloat(failAmount || '50') * 100);
      onSendStripeEvent('payment_failed', undefined, selectedCustomer, amountCents);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-52 bg-[#0a2540] border-r border-blue-900/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-blue-900/50">
          <div className="font-semibold text-sm text-white flex items-center gap-1.5">
            <span className="text-blue-400">{'\u27D0'}</span> Stripe
          </div>
          <div className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Shadow Simulation
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {STRIPE_NAV.map(nav => (
            <button
              key={nav}
              onClick={() => { setActiveNav(nav); onUserInteraction?.(); }}
              className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between transition-colors ${
                activeNav === nav
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'text-blue-200/60 hover:bg-blue-500/10 hover:text-blue-200'
              }`}
            >
              <span>{nav}</span>
              {navCounts[nav] > 0 && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  activeNav === nav ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-900/40 text-blue-300/60'
                }`}>
                  {navCounts[nav]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-[#0a2540] min-h-0">
        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#0f3358] rounded-lg p-3 border border-blue-900/50">
              <div className="text-[10px] text-blue-300/60 uppercase tracking-wider font-medium mb-1">Balance</div>
              <div className="text-lg font-semibold text-white">{formatDollars(balance)}</div>
              <div className="text-[10px] text-blue-300/40 mt-0.5">Available</div>
            </div>
            <div className="bg-[#0f3358] rounded-lg p-3 border border-blue-900/50">
              <div className="text-[10px] text-blue-300/60 uppercase tracking-wider font-medium mb-1">Activity</div>
              <div className="text-lg font-semibold text-white">{operations.length} <span className="text-sm font-normal text-blue-300/60">operations</span></div>
              {disputeCount > 0 && (
                <div className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {disputeCount} dispute{disputeCount !== 1 ? 's' : ''}
                </div>
              )}
              {disputeCount === 0 && (
                <div className="text-[10px] text-blue-300/40 mt-0.5">No disputes</div>
              )}
            </div>
          </div>

          {/* Section header */}
          <div className="text-xs font-semibold text-blue-300/60 uppercase tracking-wider mb-2">
            {activeNav === 'All' ? 'Recent Operations' : activeNav}
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-blue-300/40 text-sm">No {activeNav === 'All' ? 'operations' : activeNav.toLowerCase()} yet</div>
              <div className="text-blue-300/25 text-xs mt-2 max-w-[280px] mx-auto">Operations appear here as the agent processes Stripe API calls (charges, customers, refunds)</div>
            </div>
          ) : (
            <div className="rounded-lg border border-blue-900/50 overflow-hidden divide-y divide-blue-900/30">
              {sorted.map(op => (
                <div key={op.id}>
                  <div
                    onClick={() => { setExpandedOp(expandedOp === op.id ? null : op.id); onUserInteraction?.(); }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-500/5 transition-colors cursor-pointer"
                  >
                    <span className={`text-sm w-5 text-center ${stripeStatusColor(op).split(' ')[0]}`}>
                      {stripeStatusIcon(op)}
                    </span>
                    <span className="text-xs font-mono text-blue-300/50 w-24 truncate shrink-0">
                      {op.id}
                    </span>
                    {(op.type === 'charge' || op.type === 'refund' || op.type === 'dispute') && op.data.amount != null && (
                      <span className="text-sm font-medium text-white w-20 text-right shrink-0">
                        {formatDollars(Number(op.data.amount))}
                      </span>
                    )}
                    {op.type === 'customer' && (
                      <span className="text-sm text-blue-200/80 truncate">
                        {String(op.data.email || op.data.name || '')}
                      </span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${stripeStatusColor(op)}`}>
                      {stripeStatusLabel(op)}
                    </span>
                    <span className="text-[10px] text-blue-300/40 shrink-0 w-12 text-right">
                      {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {expandedOp === op.id && (
                    <div className="px-4 py-3 bg-[#081d33] border-t border-blue-900/30">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {Object.entries(op.data).map(([key, value]) => (
                          <div key={key} className="contents">
                            <span className="text-blue-300/50 font-medium">{key}</span>
                            <span className="text-blue-200/80 font-mono truncate">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ShadowPlay: Stripe event injection */}
        {isLive && onSendStripeEvent && (
          <div className="px-4 py-3 border-t border-blue-900/50 bg-[#081d33]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">ShadowPlay: Inject Event</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={eventType}
                onChange={e => setEventType(e.target.value)}
                className="text-xs bg-[#0f3358] text-blue-200 rounded px-2 py-1.5 border border-blue-900/50 outline-none focus:border-blue-500"
              >
                <option value="dispute_created">Dispute Opened</option>
                <option value="payment_failed">Payment Failed</option>
              </select>

              {eventType === 'dispute_created' ? (
                <>
                  <select
                    value={selectedCharge}
                    onChange={e => setSelectedCharge(e.target.value)}
                    className="text-xs bg-[#0f3358] text-blue-200 rounded px-2 py-1.5 border border-blue-900/50 outline-none focus:border-blue-500 min-w-[180px]"
                  >
                    <option value="">Select charge...</option>
                    {charges.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.id} ({formatDollars(Number(op.data.amount) || 0)})
                      </option>
                    ))}
                  </select>
                  {charges.length === 0 && (
                    <span className="text-[10px] text-blue-300/40 italic">Waiting for agent to create charges...</span>
                  )}
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="text-xs bg-[#0f3358] text-blue-200 rounded px-2 py-1.5 border border-blue-900/50 outline-none focus:border-blue-500"
                  >
                    <option value="fraudulent">Fraudulent</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="product_not_received">Product Not Received</option>
                  </select>
                </>
              ) : (
                <>
                  <select
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                    className="text-xs bg-[#0f3358] text-blue-200 rounded px-2 py-1.5 border border-blue-900/50 outline-none focus:border-blue-500 min-w-[180px]"
                  >
                    <option value="">Select customer...</option>
                    {customers.map(op => (
                      <option key={op.id} value={op.id}>
                        {op.id} ({String(op.data.email || op.data.name || '')})
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <span className="text-[10px] text-blue-300/40 italic">Waiting for agent to create customers...</span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-blue-300/60">$</span>
                    <input
                      type="text"
                      value={failAmount}
                      onChange={e => setFailAmount(e.target.value)}
                      className="text-xs bg-[#0f3358] text-blue-200 rounded px-2 py-1.5 border border-blue-900/50 outline-none focus:border-blue-500 w-20"
                      placeholder="50.00"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleInject}
                disabled={eventType === 'dispute_created' ? !selectedCharge : !selectedCustomer}
                className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Inject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gmail Persona Presets ─────────────────────────────────────────────

const GMAIL_PERSONAS = [
  { name: 'Dave Thompson', email: 'dave@clientcorp.com' },
  { name: 'Sarah Chen', email: 'sarah.chen@bigtech.io' },
  { name: 'IT Security', email: 'security@acmecorp.com' },
  { name: 'Unknown Sender', email: 'no-reply@suspicious-domain.xyz' },
];

// ── Simulated Gmail Inbox ──────────────────────────────────────────────

type GmailLabel = 'INBOX' | 'STARRED' | 'SENT' | 'DRAFT' | 'SPAM' | 'TRASH';

const GMAIL_LABELS: { key: GmailLabel; label: string; icon: string }[] = [
  { key: 'INBOX', label: 'Inbox', icon: '\uD83D\uDCE5' },
  { key: 'STARRED', label: 'Starred', icon: '\u2606' },
  { key: 'SENT', label: 'Sent', icon: '\u27A4' },
  { key: 'DRAFT', label: 'Drafts', icon: '\uD83D\uDCDD' },
  { key: 'SPAM', label: 'Spam', icon: '\u26A0' },
  { key: 'TRASH', label: 'Trash', icon: '\uD83D\uDDD1' },
];

function gmailLabelCount(emails: GmailEmail[], label: GmailLabel): number {
  if (label === 'INBOX') return emails.filter(e => !e.labels.includes('SENT') && !e.labels.includes('DRAFT') && !e.labels.includes('SPAM') && !e.labels.includes('TRASH')).length;
  return emails.filter(e => e.labels.includes(label)).length;
}

function gmailFilterByLabel(emails: GmailEmail[], label: GmailLabel): GmailEmail[] {
  if (label === 'INBOX') return emails.filter(e => !e.labels.includes('SENT') && !e.labels.includes('DRAFT') && !e.labels.includes('SPAM') && !e.labels.includes('TRASH'));
  if (label === 'STARRED') return emails.filter(e => e.labels.includes('STARRED'));
  return emails.filter(e => e.labels.includes(label));
}

function GmailWorld({ emails, onSendEmail, isLive, onUserInteraction, lastToolCall, toolCallCount }: {
  emails: GmailEmail[];
  onSendEmail?: (fromName: string, fromEmail: string, subject: string, body: string) => void;
  isLive?: boolean;
  onUserInteraction?: () => void;
  lastToolCall?: ToolCall | null;
  toolCallCount?: number;
}) {
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);
  const [activeLabel, setActiveLabel] = useState<GmailLabel>('INBOX');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMinimized, setComposeMinimized] = useState(false);
  const [replyTo, setReplyTo] = useState<GmailEmail | null>(null);

  // Compose form state
  const [fromField, setFromField] = useState(GMAIL_PERSONAS[0].name);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Auto-navigate: update Dome view based on current step's tool call
  useEffect(() => {
    if (!lastToolCall || lastToolCall.service !== 'gmail') return;
    if (lastToolCall.tool_name === 'get_message') {
      const msgId = String(lastToolCall.arguments?.message_id || '');
      if (msgId) {
        const email = emails.find(e => e.id === msgId);
        if (email) {
          if (email.labels.includes('SENT')) {
            setActiveLabel('SENT');
          } else if (email.labels.includes('DRAFT')) {
            setActiveLabel('DRAFT');
          } else {
            setActiveLabel('INBOX');
          }
          setSelectedEmail(email);
        }
      }
    } else if (lastToolCall.tool_name === 'list_messages') {
      setActiveLabel('INBOX');
      setSelectedEmail(null);
    } else if (lastToolCall.tool_name === 'send_email') {
      const to = String(lastToolCall.arguments?.to || '');
      const subject = String(lastToolCall.arguments?.subject || '');
      const fromArg = String(lastToolCall.arguments?.from || '');

      // If sent TO the agent (incoming/inject), show in INBOX
      const isIncoming = to.includes('agent@') || fromArg.includes('security') || fromArg.includes('external');
      if (isIncoming) {
        setActiveLabel('INBOX');
        const inboxEmails = emails.filter(e => !e.labels.includes('SENT') && !e.labels.includes('DRAFT'));
        const match = inboxEmails.find(e =>
          (subject && e.subject.includes(subject)) || (fromArg && e.from.includes(fromArg))
        );
        setSelectedEmail(match || null);
      } else {
        // Agent sending outbound — show SENT
        setActiveLabel('SENT');
        const sentEmails = emails.filter(e => e.labels.includes('SENT'));
        const match = sentEmails.find(e =>
          (to && e.to.includes(to)) || (subject && e.subject.includes(subject))
        );
        setSelectedEmail(match || sentEmails[sentEmails.length - 1] || null);
      }
    } else if (lastToolCall.tool_name === 'create_draft') {
      setActiveLabel('DRAFT');
      setSelectedEmail(null);
    } else if (lastToolCall.tool_name === 'delete_message') {
      setSelectedEmail(null);
    }
  }, [toolCallCount, lastToolCall, emails.length]);

  const openCompose = (reply?: GmailEmail) => {
    if (reply) {
      setReplyTo(reply);
      setEmailSubject(`Re: ${reply.subject.replace(/^Re:\s*/i, '')}`);
      setEmailBody('');
      setFromField(GMAIL_PERSONAS[0].name);
    } else {
      setReplyTo(null);
      setEmailSubject('');
      setEmailBody('');
      setFromField(GMAIL_PERSONAS[0].name);
    }
    setComposeOpen(true);
    setComposeMinimized(false);
  };

  const closeCompose = () => {
    setComposeOpen(false);
    setComposeMinimized(false);
    setReplyTo(null);
  };

  const handleSendEmail = () => {
    if (!onSendEmail || !emailSubject.trim() || !emailBody.trim()) return;
    const preset = GMAIL_PERSONAS.find(p => p.name === fromField);
    const fromName = fromField;
    const fromEmail = preset ? preset.email : `${fromField.toLowerCase().replace(/\s+/g, '.')}@external.com`;
    onSendEmail(fromName, fromEmail, emailSubject.trim(), emailBody.trim());
    setEmailSubject('');
    setEmailBody('');
    closeCompose();
  };

  const filtered = gmailFilterByLabel(emails, activeLabel);
  const isSentView = activeLabel === 'SENT';
  const isDraftView = activeLabel === 'DRAFT';

  return (
    <div className="flex-1 flex relative h-full">
      {/* Sidebar — light Gmail style */}
      <div className="w-52 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 overflow-hidden">
        <div className="p-3 border-b border-gray-200">
          <div className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="none">
              <path d="M2 6a2 2 0 0 1 2-4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" fill="#fff" stroke="#d1d5db" strokeWidth="0.5"/>
              <path d="M2 6l10 7 10-7" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 6v12h2V8l8 5.5L20 8v10h2V6l-10 7L2 6z" fill="#EA4335" fillOpacity="0.15"/>
            </svg>
            Gmail
          </div>
          <div className="text-[10px] text-green-600 flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Shadow Simulation
          </div>
        </div>

        {/* Compose button */}
        {isLive && onSendEmail && (
          <div className="p-3">
            <button
              onClick={() => openCompose()}
              className="w-full px-4 py-2.5 rounded-2xl text-sm font-medium bg-sky-100 text-gray-700 hover:bg-sky-200 hover:shadow-md transition-all shadow flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none text-gray-600">+</span> Compose
            </button>
          </div>
        )}

        {/* Labels */}
        <div className="flex-1 overflow-y-auto py-1">
          {GMAIL_LABELS.map(({ key, label, icon }) => {
            const count = gmailLabelCount(emails, key);
            const unreadCount = key === 'INBOX'
              ? gmailFilterByLabel(emails, 'INBOX').filter(e => !e.is_read).length
              : 0;
            return (
              <button
                key={key}
                onClick={() => { setActiveLabel(key); setSelectedEmail(null); onUserInteraction?.(); }}
                className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 rounded-r-full mr-2 transition-colors ${
                  activeLabel === key
                    ? 'bg-blue-100 text-blue-800 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="w-5 text-center text-xs">{icon}</span>
                <span className="flex-1 truncate">{label}</span>
                {key === 'INBOX' && unreadCount > 0 && (
                  <span className="text-[10px] font-bold text-gray-800">{unreadCount}</span>
                )}
                {key !== 'INBOX' && count > 0 && (
                  <span className="text-[10px] text-gray-400">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content — white like real Gmail */}
      <div className="flex-1 flex flex-col bg-white min-h-0 overflow-hidden">
        {selectedEmail ? (
          /* Email detail view */
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={() => { setSelectedEmail(null); onUserInteraction?.(); }}
                className="text-gray-500 hover:text-gray-800 transition-colors text-sm px-2 py-1 rounded hover:bg-gray-100"
              >
                &larr; Back
              </button>
              <div className="flex gap-1">
                {selectedEmail.labels.map(l => (
                  <span key={l} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    l === 'SENT' ? 'bg-blue-100 text-blue-700' :
                    l === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' :
                    l === 'IMPORTANT' ? 'bg-orange-100 text-orange-700' :
                    l === 'SPAM' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {l}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">{selectedEmail.subject}</h2>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                  {(selectedEmail.from || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-gray-900 font-medium">{selectedEmail.from}</div>
                  <div className="text-gray-500 text-xs">
                    to {selectedEmail.to || 'me'}
                    {' \u00B7 '}
                    {new Date(selectedEmail.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-t border-gray-200 pt-4">
                {selectedEmail.body || selectedEmail.snippet || '(no content)'}
              </div>

              {/* Reply button */}
              {isLive && onSendEmail && !selectedEmail.labels.includes('SENT') && (
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={() => openCompose(selectedEmail)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-2 border border-gray-300"
                  >
                    <span>{'\u21A9'}</span> Reply
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Email list view */
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-4 py-2.5 border-b border-gray-200 flex items-center">
              <span className="text-sm font-semibold text-gray-700">
                {GMAIL_LABELS.find(l => l.key === activeLabel)?.label}
              </span>
              {filtered.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">{filtered.length}</span>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                No emails in {GMAIL_LABELS.find(l => l.key === activeLabel)?.label.toLowerCase()}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(email => (
                  <EmailRow
                    key={email.id}
                    email={email}
                    onClick={() => { setSelectedEmail(email); onUserInteraction?.(); }}
                    isSent={isSentView}
                    isDraft={isDraftView}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Compose Window — Gmail-style white */}
      {composeOpen && (
        <div
          className="fixed bottom-0 right-8 w-80 bg-white border border-gray-300 rounded-t-lg shadow-2xl flex flex-col z-50"
        >
          {/* Compose header — dark bar like real Gmail */}
          <div
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-t-lg cursor-pointer"
            onClick={() => composeMinimized && setComposeMinimized(false)}
          >
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 uppercase tracking-wider">ShadowPlay</span>
            <span className="text-xs text-white font-medium flex-1 truncate">
              {replyTo ? `Re: ${replyTo.subject}` : 'New Message'}
            </span>
            <button
              onClick={e => { e.stopPropagation(); setComposeMinimized(!composeMinimized); }}
              className="text-gray-400 hover:text-white text-xs px-1"
              title={composeMinimized ? 'Expand' : 'Minimize'}
            >
              {composeMinimized ? '\u25A2' : '\u2501'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); closeCompose(); }}
              className="text-gray-400 hover:text-white text-xs px-1"
              title="Close"
            >
              {'\u2715'}
            </button>
          </div>

          {/* Compose body — hidden when minimized */}
          {!composeMinimized && (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-10 shrink-0">From</span>
                <select
                  value={fromField}
                  onChange={e => setFromField(e.target.value)}
                  className="flex-1 text-xs bg-transparent text-gray-800 border-b border-gray-200 outline-none focus:border-blue-500 py-1 px-1"
                >
                  {GMAIL_PERSONAS.map(p => (
                    <option key={p.name} value={p.name}>{p.name} ({p.email})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-10 shrink-0">Subject</span>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Subject..."
                  className="flex-1 text-xs bg-transparent text-gray-800 border-b border-gray-200 outline-none focus:border-blue-500 py-1 px-1"
                />
              </div>
              <textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSendEmail(); } }}
                placeholder="Compose email..."
                rows={3}
                className="text-xs bg-transparent text-gray-800 outline-none resize-none py-2 px-1 w-full"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={handleSendEmail}
                  disabled={!emailSubject.trim() || !emailBody.trim()}
                  className="px-4 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
                <button
                  onClick={closeCompose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Discard"
                >
                  <span className="text-sm">{'\uD83D\uDDD1'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmailRow({ email, onClick, isSent, isDraft }: {
  email: GmailEmail;
  onClick: () => void;
  isSent?: boolean;
  isDraft?: boolean;
}) {
  const dateStr = formatEmailDate(email.timestamp);

  return (
    <div
      onClick={onClick}
      className={`px-4 py-2.5 hover:bg-gray-50 transition-colors cursor-pointer border-l-2 ${
        email.is_read && !isSent && !isDraft ? 'border-l-transparent' : 'border-l-blue-600'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-sm w-40 shrink-0 truncate ${
          email.is_read || isSent || isDraft ? 'text-gray-500' : 'font-semibold text-gray-900'
        }`}>
          {isSent ? `To: ${email.to}` : email.from}
        </span>
        <span className={`text-sm truncate min-w-0 ${
          email.is_read || isSent || isDraft ? 'text-gray-400' : 'text-gray-700'
        }`}>
          {email.subject}
          {email.snippet && (
            <span className="text-gray-400 font-normal"> - {email.snippet}</span>
          )}
        </span>
        {email.labels.includes('IMPORTANT') && (
          <span className="text-orange-500 text-xs shrink-0">!</span>
        )}
        {isDraft && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700 font-medium shrink-0">
            DRAFT
          </span>
        )}
        <span className="text-xs text-gray-400 ml-auto shrink-0">
          {dateStr}
        </span>
      </div>
    </div>
  );
}

function formatEmailDate(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  // Otherwise show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
