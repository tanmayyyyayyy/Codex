import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEngine } from './useEngine';
import { SessionsView } from './SessionsView';
import { fetchAgents, fetchAuditVerify, setAgentStatus } from './api';
import { CATEGORY_STYLE, EVENT_META, ago, describe } from './format';
import type { AgentOverview, AuditEntry, AuditVerification, SecurityViolation } from './contract';

gsap.registerPlugin(ScrollTrigger);

function ViolationCard({ v, now, onDecide }: { v: SecurityViolation; now: number; onDecide: (id: string, action: 'ALLOW' | 'BLOCK') => Promise<void> }) {
  const { title, body } = describe(v.toolCall);
  const remaining = Math.max(0, Math.round((v.createdAt + v.ttlMs - now) / 1000));
  const highRisk = v.signal === 'behavioral' || v.signal === 'content';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (action: 'ALLOW' | 'BLOCK') => {
    setBusy(true); setError(null);
    try { await onDecide(v.id, action); }
    catch (err) { setError((err as Error).message || 'Decision could not be submitted'); }
    finally { setBusy(false); }
  };
  return <article className={`review-card ${highRisk ? 'review-card-danger' : ''}`}>
    <div className="review-card-top"><span className={`category ${CATEGORY_STYLE[v.category]}`}>{v.category}</span><span className="review-tool">{v.toolCall.tool}</span>{v.risk && <span className="risk-score">Risk {v.risk.score} · {v.risk.band}</span>}<span className="review-clock">{remaining}s</span></div>
    <div className="review-copy">
      <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{title}</h3>
      {v.ruleId && <span className="review-rule" style={{ fontSize: '0.75rem', background: 'var(--bg-accent)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)', display: 'inline-block', marginBottom: '0.5rem' }}>Rule: {v.ruleId}</span>}
      {body && <pre>{body}</pre>}
      <p>{v.reason}</p>
      {v.toolCall.sessionId && <p className="review-agent">Agent {v.toolCall.sessionId}</p>}
    </div>
    {error && <div className="review-error" role="alert">Decision failed — {error}. The action remains held.</div>}
    <div className="review-actions"><button className="approve-button" disabled={busy} onClick={() => act('ALLOW')}>{busy ? 'Submitting…' : 'Approve action'}</button><button className="deny-button" disabled={busy} onClick={() => act('BLOCK')}>{busy ? 'Submitting…' : 'Block action'}</button></div>
  </article>;
}

/** A seeded demo fixture (see src/cli/demo.ts) vs. a real runtime event. Fixtures are labelled, never faked live. */
function isFixture(e: AuditEntry): boolean {
  return e.sessionId === 'demo-session' || e.risk?.version === 'demo-fixture';
}

function AuditRow({ e, now }: { e: AuditEntry; now: number }) {
  const meta = EVENT_META[e.event];
  return <div className="audit-row"><span className="audit-event" title={meta.label}>{meta.label}</span>{isFixture(e) && <span className="audit-demo" title="Seeded demo fixture — not live runtime activity">DEMO</span>}{e.action && <span className={`audit-action ${e.action === 'ALLOW' ? 'is-allow' : 'is-block'}`}>{e.action}</span>}{e.viaHitl && <span className="audit-tag">REVIEW</span>}{e.signal && <span className="audit-tag">{e.signal.toUpperCase()}</span>}{e.risk && e.risk.score > 0 && <span className="audit-risk">{e.risk.score}</span>}<span className="audit-tool" title={e.tool ?? meta.label}>{e.tool ?? meta.label}</span><span className="audit-reason" title={e.reason}>{e.ruleId ?? e.reason}</span>{e.sessionId && <span className="audit-agent" title={`session ${e.sessionId}`}>{e.sessionId}</span>}<time title={new Date(e.ts).toLocaleString()}>{ago(e.ts, now)}</time></div>;
}

type View = 'live' | 'sessions';
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`nav-link ${active ? 'active' : ''}`}>{children}</button>;
}

function AgentControls() {
  const [agents, setAgents] = useState<AgentOverview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchAgents().then((a) => { setAgents(a); setError(null); }).catch(() => setError('Agent status is unavailable — the local gateway is unreachable.'));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const act = (id: string, status: 'active' | 'paused' | 'quarantined') => {
    setBusy(id); setError(null);
    setAgentStatus(id, status)
      .then(load)
      .catch((err: Error) => setError(`Could not set ${id} to ${status} — ${err.message}.`))
      .finally(() => setBusy(null));
  };
  return <section className="agents-section">
    <div className="section-heading compact"><div><div className="page-kicker">AGENT CONTROLS</div><h2>Governed sessions</h2></div><span className={`stream-indicator ${error ? 'offline' : ''}`}><i /> {error ? 'UNAVAILABLE' : 'SERVER-SIDE'}</span></div>
    {error && <p className="agent-error" role="alert">{error}</p>}
    {agents.length === 0
      ? <div className="empty-state"><div className="empty-mark">◦</div><div><h3>No governed sessions yet</h3><p>Status controls appear once an agent makes a tool call. Pause or quarantine blocks all further governed actions.</p></div><span className="empty-state-code">NO AGENTS</span></div>
      : <div className="agents-list">{agents.map((a) => <div className="agent-row" key={a.sessionId}>
          <span className={`agent-status agent-${a.status}`}>{a.status}</span>
          <span className="agent-id">{a.sessionId}</span>
          <span className="agent-calls">{a.governedCalls} calls</span>
          <div className="agent-actions">
            {a.status !== 'active' && <button className="agent-btn resume" disabled={busy === a.sessionId} onClick={() => act(a.sessionId, 'active')}>Resume</button>}
            {a.status !== 'paused' && <button className="agent-btn" disabled={busy === a.sessionId} onClick={() => act(a.sessionId, 'paused')}>Pause</button>}
            {a.status !== 'quarantined' && <button className="agent-btn danger" disabled={busy === a.sessionId} onClick={() => act(a.sessionId, 'quarantined')}>Quarantine</button>}
          </div>
        </div>)}</div>}
  </section>;
}

export default function App() {
  const { connected, pending, audit, decide } = useEngine();
  const [initialSession] = useState(() => typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session') ?? undefined : undefined);
  const [view, setView] = useState<View>(initialSession ? 'sessions' : 'live');
  const [now, setNow] = useState(() => Date.now());
  const [auditHealth, setAuditHealth] = useState<AuditVerification | null>(null);
  const signalRef = useRef<HTMLElement>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    let stop = false;
    const poll = () => fetchAuditVerify().then((r) => { if (!stop) setAuditHealth(r); }).catch(() => { if (!stop) setAuditHealth(null); });
    poll();
    const t = setInterval(poll, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [audit.length]);
  useEffect(() => {
    if (view !== 'live' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.from('.intro-copy > *', { y: 18, opacity: 0, duration: 0.65, stagger: 0.08, ease: 'power2.out' });
      gsap.from('.signal-card', { y: 24, opacity: 0, duration: 0.55, stagger: 0.1, ease: 'power2.out', delay: 0.25 });
      // No pinned hero: a pinned `.intro-copy` (pinSpacing:false) overlaid the summary cards as they
      // scrolled up. The in-flow hero + the subtle card parallax below keep the same feel without overlap.
      if (signalRef.current) {
        gsap.to('.signal-card', { y: (i) => i * -5, scale: (i) => 1 - i * 0.012, ease: 'none', scrollTrigger: { trigger: signalRef.current, start: 'top 70%', end: 'bottom 35%', scrub: 0.5 } });
      }
    });
    return () => ctx.revert();
  }, [view]);

  // Each tool call lands in exactly one bucket: an auto decision (ALLOW/BLOCK) or a human review
  // (hitl-opened). Counting `viaHitl` would double-count a held call against its own review request, and
  // mixing in the resolved verdict would blur "cleared by policy" with "cleared by a human".
  const signals = useMemo(() => [
    { label: 'Allowed', count: audit.filter((e) => e.event === 'decision' && e.action === 'ALLOW').length, detail: 'Cleared by policy, no review', tone: 'green' },
    { label: 'Held for review', count: audit.filter((e) => e.event === 'hitl-opened').length, detail: pending.length > 0 ? `${pending.length} awaiting a decision now` : 'Escalated to a human', tone: 'amber' },
    { label: 'Blocked', count: audit.filter((e) => e.event === 'decision' && e.action === 'BLOCK').length, detail: 'Stopped at the gateway, no review', tone: 'red' },
  ], [audit, pending.length]);

  return <div className="warden-app">
    <header className="topbar"><a className="wordmark" href="#live" onClick={(e) => { e.preventDefault(); setView('live'); }}><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 36 36" fill="none"><path d="M5 15 9 5l8 7 1 1 1-1 8-7 4 10-2 12-11 6L7 27 5 15Z"/><path d="M12 19h4l2-4 2 8 2-4h3"/><circle cx="18" cy="19" r="1"/></svg></span><span>WARDEN</span></a><nav className="main-nav"><Tab active={view === 'live'} onClick={() => setView('live')}>Live operations</Tab><Tab active={view === 'sessions'} onClick={() => setView('sessions')}>Sessions</Tab></nav><div className="engine-state"><span className={`state-dot ${connected ? 'online' : 'offline'}`} /><span>{connected ? 'Gateway online' : 'Gateway offline'}</span><span className={`audit-health ${auditHealth && !auditHealth.ok ? 'bad' : ''}`} title={auditHealth?.reason}>{auditHealth ? (auditHealth.ok ? `audit verified (${auditHealth.checked})` : 'AUDIT TAMPERED') : 'audit —'}</span></div></header>
    <main className="page-shell" id="live">
      {view === 'sessions' ? <div className="sessions-wrap"><div className="page-kicker">INVESTIGATION</div><h1 className="sessions-heading">Session history</h1><p className="sessions-intro">Follow an agent run from its first tool call to its final decision.</p><SessionsView audit={audit} now={now} initialSession={initialSession} /></div> : <>
        <section className="intro-section"><div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line" /> Local agent sentinel</div><h1>Agents move.<br /><em>Warden listens.</em></h1><p className="intro-lede">A local security sentinel between autonomous agents and your machine. Hear the intent, apply policy, and keep a human in control.</p><div className="intro-meta"><span className="live-signal"><i /> {connected ? 'SENTINEL ACTIVE' : 'GATEWAY OFFLINE'}</span><span>LOCAL POLICY ENGINE</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="core-shield"><svg viewBox="0 0 100 120" fill="none"><path d="M8 32 19 8l26 19 5 5 5-5L81 8l11 24-6 52-36 27L14 84 8 32Z"/><path d="M25 58h14l8-15 9 31 8-16h12"/><circle cx="50" cy="58" r="2"/></svg><i /></div><div className="orbit-label label-top">LISTEN / 01</div><div className="orbit-label label-bottom">INTERVENE / 02</div><div className="hero-scan"/></div></section>
        <section className="signals-section" ref={signalRef} aria-label="Decision summary"><div className="section-heading"><div><div className="page-kicker">DECISIONS AT A GLANCE</div><h2>Control, in real time.</h2></div><p>Lifetime verdicts from the audit stream · live holds in the Action center</p></div><div className="signal-grid">{signals.map((item) => <article className={`signal-card signal-${item.tone}`} key={item.label}><div className="signal-top"><span>{item.label}</span><i /></div><strong>{item.count.toLocaleString()}</strong><p>{item.detail}</p></article>)}</div><div className="marquee" aria-hidden="true"><div className="marquee-track">{Array.from({ length: 4 }, (_, i) => <span key={i}>INTERCEPT <b>·</b> EVALUATE <b>·</b> REVIEW <b>·</b> ENFORCE <b>·</b> </span>)}</div></div></section>
        <section className="operations-grid"><section className="action-section"><div className="section-heading compact"><div><div className="page-kicker">HUMAN IN THE LOOP</div><h2>Action center <sup>{pending.length.toString().padStart(2, '0')}</sup></h2></div><span className={`awaiting-label ${pending.length === 0 ? 'clear' : ''}`}>{pending.length > 0 ? 'Response needed' : 'No live holds'}</span></div>{pending.length === 0 ? <div className="empty-state"><div className="empty-mark">✓</div><div><h3>No pending approvals</h3><p>Actions within policy continue. Anything requiring review will appear here.</p></div><span className="empty-state-code">QUEUE CLEAR</span></div> : <div className="review-grid">{pending.map((v) => <ViolationCard key={v.id} v={v} now={now} onDecide={decide} />)}</div>}</section>
          <section className="audit-section"><div className="section-heading compact"><div><div className="page-kicker">AUDIT TRAIL</div><h2>Live stream</h2></div><span className={`stream-indicator ${connected ? '' : 'offline'}`}><i /> {connected ? 'STREAMING' : 'OFFLINE'}</span></div><div className="audit-panel">{audit.length === 0 ? <div className="audit-empty">{connected ? 'Waiting for the first agent action…' : 'Connect the local gateway to receive events.'}</div> : <div className="audit-list">{audit.map((e, idx) => <AuditRow key={`${e.ts}-${idx}`} e={e} now={now} />)}</div>}</div></section></section>
        <AgentControls />
      </>}
    </main><footer className="site-footer"><span>WARDEN <b>·</b> AGENT SECURITY GATEWAY</span><span>LISTEN. INTERPRET. CONTAIN.</span></footer>
  </div>;
}
