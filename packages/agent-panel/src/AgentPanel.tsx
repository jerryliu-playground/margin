import { useId, useSyncExternalStore } from 'react';
import type { EditorHost } from '@margin/shared';

export interface AgentPanelProps {
  host: EditorHost;
  /** Base URL of the agent server, e.g. http://localhost:8787 */
  agentUrl: string;
}

/**
 * Host-agnostic agent side panel. Phase 0: shell only.
 * Phase 1 adds the AG-UI client, streaming messages and proposal cards (ADR 0002).
 */
export function AgentPanel({ host }: AgentPanelProps) {
  const headingId = useId();
  const state = useSyncExternalStore(
    (onChange) => host.subscribe(onChange),
    () => host.getState(),
  );

  return (
    <aside className="margin-panel" aria-labelledby={headingId}>
      <h2 id={headingId} className="margin-panel__title">
        Agent
      </h2>
      <p className="margin-panel__status">
        Sees {Object.keys(state.fields).length} fields and {state.body.length} blocks.
      </p>
    </aside>
  );
}
