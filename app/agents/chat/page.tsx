'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  timestamp: Date;
}

interface AgentRun {
  id: string;
  query: string;
  status: string;
  programName: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusDot(status: string) {
  if (status === 'completed') return { color: '#22C55E', label: 'Done' };
  if (status === 'failed') return { color: '#EF4444', label: 'Failed' };
  return { color: '#F59E0B', label: 'Running' };
}

function renderMarkdown(text: string) {
  // Very lightweight markdown: bold, code, headings, bullets
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 4px;font-size:13px;color:#1F3864">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:14px 0 6px;font-size:14px;color:#1F3864">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin:16px 0 8px;font-size:15px;color:#1F3864">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:#F3F4F6;padding:1px 5px;border-radius:3px;font-family:Consolas,monospace;font-size:12px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0">$1</li>')
    .replace(/\n/g, '<br/>');
}

// ---------------------------------------------------------------------------
// Tool call card
// ---------------------------------------------------------------------------

function ToolCallCard({ msg }: { msg: ChatMessage }) {
  const [open, setOpen] = useState(false);
  const toolLabel = msg.toolName?.replace(/_/g, ' ') ?? 'tool';

  return (
    <div style={{
      background: '#FFFBEB',
      border: '1px solid #FCD34D',
      borderRadius: 8,
      margin: '6px 0',
      fontSize: 12,
      fontFamily: 'Consolas, monospace',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#92400E',
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <span style={{ fontSize: 14 }}>⚙</span>
        <span>Tool: {toolLabel}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 12px 10px', borderTop: '1px solid #FCD34D' }}>
          {msg.toolInput && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#78350F', marginBottom: 4, fontFamily: 'system-ui', fontWeight: 600 }}>Input</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#44403C', fontSize: 11 }}>
                {JSON.stringify(msg.toolInput, null, 2)}
              </pre>
            </div>
          )}
          {msg.toolResult && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#78350F', marginBottom: 4, fontFamily: 'system-ui', fontWeight: 600 }}>Result</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#44403C', fontSize: 11, maxHeight: 200, overflow: 'auto' }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(msg.toolResult), null, 2);
                  } catch {
                    return msg.toolResult;
                  }
                })()}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner page (uses useSearchParams — must be inside Suspense)
// ---------------------------------------------------------------------------

const AGENT_LABELS: Record<string, { name: string; icon: string }> = {
  general: { name: 'MAVEN Agent', icon: '🤖' },
  rules: { name: 'Business Rules Analyst', icon: '📋' },
  impact: { name: 'Change Impact Assessor', icon: '🎯' },
  spec: { name: 'Modernization Planner', icon: '🏗️' },
  dep: { name: 'Dependency Navigator', icon: '🕸️' },
  portfolio: { name: 'Portfolio Analyst', icon: '📊' },
};

const AGENT_PROMPTS: Record<string, string[]> = {
  general: ['What does COACTUPC do?', 'Search for programs related to account', 'What is the blast radius of COSGN00C?', 'Trigger full analysis for CBSTM03A'],
  rules: ['Show me the business rules for COADSTPC', 'What are the key data validations in COACTUPC?', 'Which rules reference the ACCT-STATUS field?', 'Summarise the BRD for COSGN00C'],
  impact: ['What breaks if I modify COACTUPC?', 'Which JCL jobs call COSGN00C?', 'List all critical impacts for COADSTPC', 'Give me a CAB summary for changing CBSTM03A'],
  spec: ['Explain the modernization spec for COACTUPC', 'How would COSGN00C map to Java Spring Boot?', 'What are the migration risks for COADSTPC?', 'What target architecture is recommended?'],
  dep: ['Show me the call chain from COACTUPC', 'Which programs share the same copybooks?', 'How many hops from COACTUPC to CBSTM03A?', 'List all data stores accessed by COSGN00C'],
  portfolio: ['How many programs have been analyzed?', 'Find all COBOL programs over 1000 LOC', 'Which programs in the account domain?', 'What is the overall analysis coverage?'],
};

function AgentsPageInner() {
  const searchParams = useSearchParams();
  const initialProgram = searchParams.get('program') ?? '';
  const agentId = searchParams.get('agent') ?? 'general';
  const agentMeta = AGENT_LABELS[agentId] ?? AGENT_LABELS.general;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [programName, setProgramName] = useState(initialProgram);
  const [isStreaming, setIsStreaming] = useState(false);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [providerOk, setProviderOk] = useState<boolean | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load run history
  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/runs');
      if (res.ok) {
        const data = (await res.json()) as { runs: AgentRun[] };
        setRuns(data.runs ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Check provider on mount
  useEffect(() => {
    loadRuns();
    // Quick provider check — POST with empty query and see if we get 400 vs 503
    fetch('/api/agents/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '__ping__' }),
    })
      .then((r) => {
        setProviderOk(r.status !== 400);
      })
      .catch(() => setProviderOk(false));
  }, [loadRuns]);

  const addMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: Math.random().toString(36).slice(2), timestamp: new Date() },
    ]);
  }, []);

  const updateLastAssistant = useCallback((append: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = { ...copy[i], content: copy[i].content + append };
          return copy;
        }
      }
      // No assistant message yet — create one
      return [
        ...copy,
        {
          id: Math.random().toString(36).slice(2),
          role: 'assistant' as const,
          content: append,
          timestamp: new Date(),
        },
      ];
    });
  }, []);

  const sendMessage = useCallback(async () => {
    const query = input.trim();
    if (!query || isStreaming) return;

    setInput('');
    setIsStreaming(true);

    // Build history from current messages (user/assistant only)
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    addMessage({ role: 'user', content: query });

    const abort = new AbortController();
    abortRef.current = abort;

    // Pending tool calls that haven't received results yet
    const pendingTools = new Map<string, string>(); // id -> msgId

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          query,
          history,
          programName: programName || undefined,
          agentId,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        addMessage({
          role: 'assistant',
          content: `Error: ${err.error ?? res.statusText}`,
        });
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Parse SSE frames
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventType = '';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataStr) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (eventType === 'run_id') {
            setCurrentRunId(String(payload.runId ?? ''));
          } else if (eventType === 'text') {
            updateLastAssistant(String(payload.text ?? ''));
          } else if (eventType === 'tool_call') {
            const msgId = Math.random().toString(36).slice(2);
            pendingTools.set(String(payload.id ?? ''), msgId);
            setMessages((prev) => [
              ...prev,
              {
                id: msgId,
                role: 'tool_call',
                content: '',
                toolName: String(payload.name ?? ''),
                toolInput: payload.input as Record<string, unknown>,
                timestamp: new Date(),
              },
            ]);
          } else if (eventType === 'tool_result') {
            const tid = String(payload.id ?? '');
            const parentId = pendingTools.get(tid);
            if (parentId) {
              // Attach result to the existing tool_call card
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === parentId
                    ? { ...m, toolResult: String(payload.content ?? '') }
                    : m
                )
              );
            }
          } else if (eventType === 'done') {
            loadRuns();
          } else if (eventType === 'error') {
            addMessage({
              role: 'assistant',
              content: `Agent error: ${String(payload.error ?? 'Unknown error')}`,
            });
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        addMessage({ role: 'assistant', content: `Connection error: ${String(err)}` });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, programName, addMessage, updateLastAssistant, loadRuns]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    if (isStreaming) {
      abortRef.current?.abort();
    }
    setMessages([]);
    setCurrentRunId(null);
    textareaRef.current?.focus();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: '"Segoe UI", system-ui, sans-serif', background: '#F4F7FA' }}>
      {/* Header */}
      <header style={{
        background: '#1F3864',
        color: '#fff',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1, color: '#E07B39' }}>MAVEN</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>CARTA</div>
            <div style={{ fontSize: 9, opacity: 0.6, lineHeight: 1, letterSpacing: 0.5 }}>Mainframe Intelligence</div>
          </div>
        </Link>

        <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Link href="/programs" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>All Programs</Link>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
          <Link href="/agents" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Agents</Link>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
          <span style={{ color: '#fff' }}>{agentMeta.icon} {agentMeta.name}</span>
        </div>

        <div style={{ flex: 1 }} />

        <Link href="/agents" style={{ color: '#E07B39', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid #E07B39', borderRadius: 6, fontWeight: 600 }}>
          ← All Agents
        </Link>
        <Link href="/settings" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6 }}>
          Settings
        </Link>
      </header>

      {/* Provider warning */}
      {providerOk === false && (
        <div style={{ background: '#FEF3C7', borderBottom: '1px solid #FCD34D', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
          <span>Agent requires an Anthropic API key (your main analysis provider can remain Groq or OpenAI).</span>
          <Link href="/settings" style={{ color: '#1F3864', fontWeight: 700, textDecoration: 'underline' }}>Go to Settings</Link>
        </div>
      )}

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: 280,
          background: '#fff',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {/* Sidebar header */}
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864', marginBottom: 8 }}>{agentMeta.icon} {agentMeta.name}</div>

            {/* Program selector */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Program (optional)</label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value.toUpperCase())}
                placeholder="e.g. COACTUPC"
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 12,
                  fontFamily: 'Consolas, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: '#F9FAFB',
                }}
              />
            </div>

            <button
              onClick={startNewChat}
              style={{
                width: '100%',
                background: '#1F3864',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              + New Chat
            </button>
          </div>

          {/* Run history */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <div style={{ padding: '4px 16px 8px', fontSize: 11, color: '#9CA3AF', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Recent Runs
            </div>
            {runs.length === 0 && (
              <div style={{ padding: '12px 16px', fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>
                No runs yet. Start a conversation below.
              </div>
            )}
            {runs.slice(0, 20).map((run) => {
              const dot = statusDot(run.status);
              const isActive = run.id === currentRunId;
              return (
                <div
                  key={run.id}
                  style={{
                    padding: '8px 16px',
                    cursor: 'default',
                    borderLeft: isActive ? '3px solid #E07B39' : '3px solid transparent',
                    background: isActive ? '#FFF7ED' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {run.query.slice(0, 48)}{run.query.length > 48 ? '…' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9CA3AF' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, display: 'inline-block', flexShrink: 0 }} />
                    <span>{dot.label}</span>
                    {run.programName && <span style={{ color: '#6B7280' }}>· {run.programName}</span>}
                    <span style={{ marginLeft: 'auto' }}>{formatTime(run.createdAt)}</span>
                  </div>
                  {run.tokensUsed != null && run.tokensUsed > 0 && (
                    <div style={{ fontSize: 10, color: '#D1D5DB', marginTop: 1 }}>
                      {run.tokensUsed.toLocaleString()} tokens
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chat area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Message thread */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {messages.length === 0 && (
              <div style={{ maxWidth: 600, margin: '60px auto 0', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>{agentMeta.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1F3864', marginBottom: 8 }}>{agentMeta.name}</div>
                <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7, marginBottom: 32 }}>
                  Ask me anything about your COBOL/JCL programs. I can fetch program metadata,
                  source code, business rules, change impact analysis, and trigger new analysis runs.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {(AGENT_PROMPTS[agentId] ?? AGENT_PROMPTS.general).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => { setInput(prompt); textareaRef.current?.focus(); }}
                      style={{
                        padding: '8px 14px',
                        background: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: 20,
                        fontSize: 12,
                        color: '#374151',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#E07B39')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => {
              if (msg.role === 'tool_call') {
                return <ToolCallCard key={msg.id} msg={msg} />;
              }

              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      maxWidth: '72%',
                      padding: '12px 16px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      background: isUser ? '#1F3864' : '#fff',
                      color: isUser ? '#fff' : '#1F2937',
                      fontSize: 14,
                      lineHeight: 1.6,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      border: isUser ? 'none' : '1px solid #E5E7EB',
                    }}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '4px 16px 16px 16px',
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#9CA3AF',
                        display: 'inline-block',
                        animation: 'bounce 1.2s infinite',
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '16px 32px',
            borderTop: '1px solid #E5E7EB',
            background: '#fff',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || providerOk === false}
              placeholder={
                providerOk === false
                  ? 'Agent requires an Anthropic API key — go to Settings to add one'
                  : 'Ask the agent anything about your mainframe programs… (Enter to send, Shift+Enter for newline)'
              }
              rows={2}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                background: providerOk === false ? '#F9FAFB' : '#fff',
                color: '#1F2937',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1F3864')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
            />
            <button
              onClick={isStreaming ? () => abortRef.current?.abort() : sendMessage}
              disabled={!isStreaming && (!input.trim() || providerOk === false)}
              style={{
                padding: '10px 20px',
                background: isStreaming ? '#EF4444' : '#E07B39',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: isStreaming || (input.trim() && providerOk !== false) ? 'pointer' : 'not-allowed',
                opacity: !isStreaming && (!input.trim() || providerOk === false) ? 0.5 : 1,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {isStreaming ? 'Stop' : 'Send'}
            </button>
          </div>
        </main>
      </div>

      {/* Bounce animation for typing indicator */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export with Suspense boundary (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading…
      </div>
    }>
      <AgentsPageInner />
    </Suspense>
  );
}
