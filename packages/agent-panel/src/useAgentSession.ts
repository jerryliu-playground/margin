import type { EditorHost } from '@margin/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createAgentSession, type AgentSession, type SessionSnapshot } from './agent-session';

/** One session per mounted panel; the snapshot re-renders the panel on every change. */
export function useAgentSession(
  host: EditorHost,
  agentUrl: string,
): [AgentSession, SessionSnapshot] {
  const [session] = useState(() => createAgentSession({ host, agentUrl }));
  useEffect(() => session.dispose, [session]);
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return [session, snapshot];
}
