import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.tsx';
import './styles.css';
import './inspection.css';
import './activity.css';
import './terminal.css';
import './responsive.css';

const root = document.querySelector('#root');
if (!root) throw new Error('Antiky Studio requires a root element.');

createRoot(root).render(
  <StrictMode>
    <App platform={window.__TAURI_INTERNALS__ ? 'native' : 'browser'} />
  </StrictMode>,
);
