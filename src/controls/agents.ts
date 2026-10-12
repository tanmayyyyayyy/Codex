/**
 * Agent controls (M9) — operator pause / resume / quarantine over a governed session.
 *
 * Server-side state only: the engine consults this store at the top of every `/intercept` decision, so
 * a paused or quarantined session cannot execute a governed action even through a previously pending
 * approval. In-memory per process (single local Engine), mirroring the behavioral/contamination
 * monitors; the interface is the seam for a Redis-backed store in the multi-instance paid tier.
 */
import type { AgentControl, AgentStatus } from '../contract/types.js';

export const AGENT_STATUSES: ReadonlySet<AgentStatus> = new Set<AgentStatus>(['active', 'paused', 'quarantined']);

export class AgentControlStore {
  private readonly map = new Map<string, AgentControl>();

  get(sessionId: string): AgentControl | undefined {
    return this.map.get(sessionId);
  }

  /** A session with no explicit control is active. */
  status(sessionId: string | undefined): AgentStatus {
    if (!sessionId) return 'active';
    return this.map.get(sessionId)?.status ?? 'active';
  }

  set(sessionId: string, status: AgentStatus, reason?: string): AgentControl {
    const control: AgentControl = { sessionId, status, reason, updatedAt: Date.now() };
    this.map.set(sessionId, control);
    return control;
  }

  list(): AgentControl[] {
    return [...this.map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * If this session is paused/quarantined, return the operator-facing block reason (governed actions
   * must not run); otherwise null. Quarantine is the stricter state and can only be cleared by resume.
   */
  blockReason(sessionId: string | undefined): string | null {
    const status = this.status(sessionId);
    if (status === 'active') return null;
    const id = sessionId ?? 'default';
    return status === 'quarantined'
      ? `Agent ${id} is quarantined — governed actions are blocked until an operator resumes it.`
      : `Agent ${id} is paused — governed actions are blocked until an operator resumes it.`;
  }

  /** Trigger an automatic quarantine when the risk threshold is exceeded. */
  autoQuarantine(sessionId: string, reason: string): AgentControl {
    return this.set(sessionId, 'quarantined', `[AUTO] ${reason}`);
  }
}
