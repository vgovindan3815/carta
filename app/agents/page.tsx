'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Agent catalog definitions
// ---------------------------------------------------------------------------

interface AgentDef {
  id: string;
  icon: string;
  name: string;
  tagline: string;
  description: string;
  capabilities: string[];
  badge?: string;
  badgeColor?: string;
}

const AGENTS: AgentDef[] = [
  {
    id: 'general',
    icon: '🤖',
    name: 'MAVEN Agent',
    tagline: 'General-purpose mainframe analyst',
    description:
      'Freeform conversational agent with full tool access. Ask anything about your COBOL/JCL programs — it autonomously fetches source code, dependency graphs, business rules, and change impact data to answer your questions.',
    capabilities: [
      'Fetch program metadata & dep graphs',
      'Read stored COBOL source code',
      'Retrieve business rules (BRD)',
      'Change impact blast radius',
      'Search the program registry',
      'Trigger new analysis runs',
    ],
    badge: 'Recommended',
    badgeColor: '#22C55E',
  },
  {
    id: 'rules',
    icon: '📋',
    name: 'Business Rules Analyst',
    tagline: 'Deep-dive into business requirements',
    description:
      'Specialized agent for interpreting and explaining the business rules extracted from your COBOL programs. Ideal for business analysts and SMEs who need plain-English explanations of what the code does.',
    capabilities: [
      'Explain BRD sections in plain English',
      'Cross-reference rules with source citations',
      'Identify missing or ambiguous requirements',
      'Compare rules across multiple programs',
      'Export-ready requirement summaries',
    ],
  },
  {
    id: 'impact',
    icon: '🎯',
    name: 'Change Impact Assessor',
    tagline: 'Blast radius & risk analysis',
    description:
      'Focused on change impact analysis — helps you understand which programs, jobs, and data stores are affected when you modify a program. Essential before any code change or migration.',
    capabilities: [
      'Compute blast radius for a program',
      'Rank impacts by severity (critical / high / medium)',
      'Trace transitive call chains',
      'Identify JCL job dependencies',
      'Summarise risk for change advisory boards',
    ],
  },
  {
    id: 'spec',
    icon: '🏗️',
    name: 'Modernization Planner',
    tagline: 'Cloud migration blueprints',
    description:
      'Helps you plan and explain modernization specifications. Reviews the generated migration blueprints, answers questions about target architecture, and helps you build a case for the migration roadmap.',
    capabilities: [
      'Review modernization spec sections',
      'Explain target architecture decisions',
      'Map COBOL constructs to Java/Spring equivalents',
      'Identify migration risks & blockers',
      'Generate executive summaries',
    ],
  },
  {
    id: 'dep',
    icon: '🕸️',
    name: 'Dependency Navigator',
    tagline: 'Graph traversal & relationship mapping',
    description:
      'Expert at navigating dependency graphs. Ask about call chains, data flows, copybook usage, and JCL orchestration. Helps you understand how programs are connected across the portfolio.',
    capabilities: [
      'Traverse multi-hop call chains',
      'Identify shared copybooks & data stores',
      'Explain JCL step sequencing',
      'Find orphaned or unreferenced programs',
      'Summarise portfolio connectivity',
    ],
  },
  {
    id: 'portfolio',
    icon: '📊',
    name: 'Portfolio Analyst',
    tagline: 'Estate-wide insights',
    description:
      'Takes a portfolio-wide view across all analyzed programs. Useful for program managers and architects who need aggregate metrics, coverage reports, and cross-domain analysis.',
    capabilities: [
      'Search and filter the full program registry',
      'Report analysis coverage across the estate',
      'Identify high-LOC / high-complexity programs',
      'Group programs by domain or language',
      'Suggest analysis priorities',
    ],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentRun {
  id: string;
  query: string;
  status: string;
  programName: string | null;
  tokensUsed: number | null;
  createdAt: string;
  model: string | null;
  provider: string | null;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusDot(status: string) {
  if (status === 'completed') return { color: '#22C55E', label: 'Completed' };
  if (status === 'failed') return { color: '#EF4444', label: 'Failed' };
  return { color: '#F59E0B', label: 'Running' };
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({ agent }: { agent: AgentDef }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `2px solid ${hovered ? '#1F3864' : '#E5E7EB'}`,
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 20px rgba(31,56,100,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
        cursor: 'default',
        position: 'relative',
      }}
    >
      {/* Badge */}
      {agent.badge && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          background: agent.badgeColor ?? '#6B7280',
          color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 10, letterSpacing: 0.5,
        }}>
          {agent.badge}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: '#F0F4FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>
          {agent.icon}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1F2937' }}>{agent.name}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{agent.tagline}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
        {agent.description}
      </p>

      {/* Capabilities */}
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {agent.capabilities.map((cap) => (
          <li key={cap} style={{ fontSize: 12, color: '#4B5563', lineHeight: 1.4 }}>{cap}</li>
        ))}
      </ul>

      {/* Launch button */}
      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
        <Link
          href={`/agents/chat?agent=${agent.id}`}
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '9px 16px',
            background: hovered ? '#1F3864' : '#F4F7FA',
            color: hovered ? '#fff' : '#1F3864',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            border: `1.5px solid ${hovered ? '#1F3864' : '#D1D5DB'}`,
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          Launch Agent →
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/runs');
      if (res.ok) {
        const data = (await res.json()) as { runs: AgentRun[] };
        setRuns(data.runs ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FA', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{
        background: '#1F3864', color: '#fff',
        padding: '0 32px', height: 56,
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        position: 'sticky', top: 0, zIndex: 100,
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
          <span style={{ color: '#fff', fontWeight: 600 }}>Agents</span>
        </div>

        <div style={{ flex: 1 }} />

        <Link href="/settings" style={{
          color: 'rgba(255,255,255,0.7)', fontSize: 12, textDecoration: 'none',
          padding: '4px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
        }}>
          ⚙ Settings
        </Link>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 32px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1F3864' }}>MAVEN Agents</h1>
            <span style={{
              background: '#E07B39', color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, letterSpacing: 0.5,
            }}>
              AI-POWERED
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.6, maxWidth: 680 }}>
            Specialized AI agents that autonomously call tools, query your program registry, and deliver
            structured analysis. Each agent is tuned for a specific modernization workflow.
            Requires <strong>Anthropic</strong> provider configured in{' '}
            <Link href="/settings" style={{ color: '#1F3864', fontWeight: 600 }}>Settings</Link>.
          </p>
        </div>

        {/* Agent grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 20,
          marginBottom: 48,
        }}>
          {AGENTS.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>

        {/* Recent runs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1F3864' }}>Recent Agent Runs</h2>
            <button
              onClick={loadRuns}
              style={{
                background: 'none', border: '1px solid #E5E7EB', borderRadius: 6,
                padding: '4px 12px', fontSize: 12, color: '#6B7280', cursor: 'pointer',
              }}
            >
              ↺ Refresh
            </button>
          </div>

          {loading && (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '24px 0' }}>Loading runs…</div>
          )}

          {!loading && runs.length === 0 && (
            <div style={{
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
              padding: '32px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 14, color: '#6B7280' }}>No agent runs yet. Launch an agent above to get started.</div>
            </div>
          )}

          {!loading && runs.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Query</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Program</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Status</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Tokens</th>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#374151' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => {
                    const dot = statusDot(run.status);
                    return (
                      <tr
                        key={run.id}
                        style={{ borderBottom: i < runs.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                      >
                        <td style={{ padding: '10px 16px', color: '#1F2937', maxWidth: 360 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {run.query.slice(0, 80)}{run.query.length > 80 ? '…' : ''}
                          </div>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          {run.programName ? (
                            <Link
                              href={`/programs/${encodeURIComponent(run.programName)}`}
                              style={{ color: '#1F3864', fontFamily: 'Consolas, monospace', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                            >
                              {run.programName}
                            </Link>
                          ) : (
                            <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot.color, display: 'inline-block' }} />
                            <span style={{ color: '#374151' }}>{dot.label}</span>
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', color: '#6B7280', fontFamily: 'Consolas, monospace', fontSize: 12 }}>
                          {run.tokensUsed != null && run.tokensUsed > 0
                            ? run.tokensUsed.toLocaleString()
                            : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', color: '#9CA3AF', fontSize: 12 }}>
                          {formatTime(run.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
