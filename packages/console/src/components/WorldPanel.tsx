import { useState } from 'react';
import type { SlackChannel, StripeOperation, GmailEmail } from '../types';

interface WorldPanelProps {
  service: string;
  slackChannels: SlackChannel[];
  stripeOperations: StripeOperation[];
  gmailEmails: GmailEmail[];
}

export function WorldPanel({ service, slackChannels, stripeOperations, gmailEmails }: WorldPanelProps) {
  if (service === 'slack') return <SlackWorld channels={slackChannels} />;
  if (service === 'stripe') return <StripeWorld operations={stripeOperations} />;
  if (service === 'gmail') return <GmailWorld emails={gmailEmails} />;
  return <div className="flex-1 flex items-center justify-center text-gray-600">Waiting for agent activity...</div>;
}

// ── Simulated Slack UI ─────────────────────────────────────────────────

function SlackWorld({ channels }: { channels: SlackChannel[] }) {
  const [activeChannel, setActiveChannel] = useState(channels[1]?.name || channels[0]?.name || '');

  const active = channels.find(c => c.name === activeChannel) || channels[0];

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
              onClick={() => setActiveChannel(ch.name)}
              className={`w-full px-3 py-1 text-left text-sm flex items-center gap-1.5 transition-colors ${
                activeChannel === ch.name
                  ? 'bg-[#1164a3] text-white'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              <span className="text-gray-500">{ch.name.startsWith('DM:') ? '@' : '#'}</span>
              <span className="truncate">{ch.name}</span>
              {ch.messages.some(m => m.is_agent) && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-shadow-500 shrink-0" />
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
                      ? 'bg-gradient-to-br from-shadow-500 to-shadow-700 text-white'
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {msg.is_agent ? 'S' : (msg.user_name || '?')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-sm font-semibold ${msg.is_agent ? 'text-shadow-400' : 'text-white'}`}>
                        {msg.user_name}
                      </span>
                      <span className="text-[10px] text-gray-600">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.is_agent && (
                        <span className="px-1 py-0.5 rounded text-[9px] bg-shadow-500/10 text-shadow-400 font-medium">
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
            </div>
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

function StripeWorld({ operations }: { operations: StripeOperation[] }) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#0a2540] p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Stripe Dashboard</h2>
        <p className="text-sm text-blue-300/60">Shadow Simulation</p>
      </div>

      {operations.length === 0 ? (
        <div className="text-center text-blue-300/40 py-12">
          No financial operations yet
        </div>
      ) : (
        <div className="space-y-3">
          {operations.map((op, i) => (
            <div key={i} className="bg-[#0f3358] rounded-lg p-4 border border-blue-900/50">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  op.type === 'refund' ? 'text-orange-400 bg-orange-400/10' :
                  op.type === 'dispute' ? 'text-red-400 bg-red-400/10' :
                  op.type === 'charge' ? 'text-green-400 bg-green-400/10' :
                  'text-blue-400 bg-blue-400/10'
                }`}>
                  {op.type}
                </span>
                <span className="text-xs font-mono text-blue-300/60">{op.id}</span>
                <span className="text-[10px] text-blue-300/40 ml-auto">
                  {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <pre className="text-xs text-blue-200/80 font-mono overflow-x-auto">
                {JSON.stringify(op.data, null, 2).slice(0, 500)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Simulated Gmail Inbox ──────────────────────────────────────────────

function GmailWorld({ emails }: { emails: GmailEmail[] }) {
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);

  if (selectedEmail) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#1a1a2e]">
        {/* Email detail header */}
        <div className="p-4 border-b border-gray-800 flex items-center gap-3">
          <button
            onClick={() => setSelectedEmail(null)}
            className="text-gray-400 hover:text-white transition-colors text-sm px-2 py-1 rounded hover:bg-gray-800"
          >
            &larr; Back
          </button>
          <div className="flex gap-1">
            {selectedEmail.labels.map(l => (
              <span key={l} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                l === 'SENT' ? 'bg-blue-500/10 text-blue-400' :
                l === 'DRAFT' ? 'bg-yellow-500/10 text-yellow-400' :
                l === 'IMPORTANT' ? 'bg-orange-500/10 text-orange-400' :
                l === 'SPAM' ? 'bg-red-500/10 text-red-400' :
                'bg-gray-700/50 text-gray-400'
              }`}>
                {l}
              </span>
            ))}
          </div>
        </div>

        {/* Email content */}
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">{selectedEmail.subject}</h2>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
              {(selectedEmail.from || '?')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-gray-200">{selectedEmail.from}</div>
              <div className="text-gray-500 text-xs">
                to {selectedEmail.to || 'me'}
                {' · '}
                {new Date(selectedEmail.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap border-t border-gray-800 pt-4">
            {selectedEmail.body || selectedEmail.snippet || '(no content)'}
          </div>
        </div>
      </div>
    );
  }

  // Separate inbox and sent
  const inbox = emails.filter(e => !e.labels.includes('SENT') && !e.labels.includes('DRAFT'));
  const sent = emails.filter(e => e.labels.includes('SENT'));
  const drafts = emails.filter(e => e.labels.includes('DRAFT'));

  return (
    <div className="flex-1 overflow-y-auto bg-[#1a1a2e]">
      {/* Inbox */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-300">
          Inbox
          {inbox.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              {inbox.filter(e => !e.is_read).length} unread
            </span>
          )}
        </h2>
      </div>

      {emails.length === 0 ? (
        <div className="text-center text-gray-600 py-12">
          No emails in simulation
        </div>
      ) : (
        <>
          {inbox.length > 0 && (
            <div className="divide-y divide-gray-800/50">
              {inbox.map((email) => (
                <EmailRow key={email.id} email={email} onClick={() => setSelectedEmail(email)} />
              ))}
            </div>
          )}

          {/* Sent section */}
          {sent.length > 0 && (
            <>
              <div className="p-4 border-b border-t border-gray-800 mt-2">
                <h2 className="text-sm font-semibold text-blue-400">
                  Sent by Agent
                  <span className="ml-2 text-xs font-normal text-gray-500">{sent.length}</span>
                </h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                {sent.map((email) => (
                  <EmailRow key={email.id} email={email} onClick={() => setSelectedEmail(email)} isSent />
                ))}
              </div>
            </>
          )}

          {/* Drafts section */}
          {drafts.length > 0 && (
            <>
              <div className="p-4 border-b border-t border-gray-800 mt-2">
                <h2 className="text-sm font-semibold text-yellow-400">
                  Drafts
                  <span className="ml-2 text-xs font-normal text-gray-500">{drafts.length}</span>
                </h2>
              </div>
              <div className="divide-y divide-gray-800/50">
                {drafts.map((email) => (
                  <EmailRow key={email.id} email={email} onClick={() => setSelectedEmail(email)} isDraft />
                ))}
              </div>
            </>
          )}
        </>
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
      className={`px-4 py-3 hover:bg-gray-800/30 transition-colors cursor-pointer ${
        email.is_read && !isSent && !isDraft ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-sm truncate w-36 shrink-0 ${
          email.is_read || isSent || isDraft ? 'text-gray-400' : 'font-semibold text-white'
        }`}>
          {isSent ? `To: ${email.to}` : email.from}
        </span>
        <span className={`text-sm truncate ${
          email.is_read || isSent || isDraft ? 'text-gray-500' : 'text-gray-200'
        }`}>
          {email.subject}
        </span>
        {email.labels.includes('IMPORTANT') && (
          <span className="text-orange-400 text-xs shrink-0">!</span>
        )}
        {isDraft && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/10 text-yellow-400 font-medium shrink-0">
            DRAFT
          </span>
        )}
        <span className="text-xs text-gray-600 ml-auto shrink-0">
          {dateStr}
        </span>
      </div>
      <p className="text-xs text-gray-600 mt-0.5 truncate pl-[156px]">
        {email.snippet}
      </p>
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
