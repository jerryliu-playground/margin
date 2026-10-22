import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@margin/agent-panel/styles.css';
import { App } from './App';
import './app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
