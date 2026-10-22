import { AgentPanel } from '@margin/agent-panel';
import { createStaticHost } from './static-host';

const host = createStaticHost();
const agentUrl = import.meta.env.VITE_AGENT_URL ?? 'http://localhost:8787';

export function App() {
  return (
    <div className="app">
      <main className="app__main">
        <h1>Margin</h1>
        <p>The editor arrives in Phase 1.</p>
      </main>
      <AgentPanel host={host} agentUrl={agentUrl} />
    </div>
  );
}
