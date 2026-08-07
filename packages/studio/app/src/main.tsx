import '@fontsource-variable/inter';
import '@fontsource-variable/space-grotesk';
import '@fontsource/ibm-plex-mono/400.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { closeNativeTerminal } from './NativeTerminal.tsx';
import {
  App,
  resolveInitialStudioPage,
  studioPageHref,
  type StudioPage,
} from './App.tsx';
import {
  applySspsPresencePreference,
  readSspsPresenceEnabled,
  startSspsPresence,
} from './sspsPresence.ts';
import './styles.css';
import './inspection.css';
import './activity.css';
import './terminal.css';
import './settings.css';
import './launcher.css';
import './responsive.css';

const root = document.querySelector('#root');
if (!root) throw new Error('Antiky Studio requires a root element.');

const platform = window.__TAURI_INTERNALS__ ? 'native' : 'browser';
const sspsPresenceEnabled = readSspsPresenceEnabled(window.localStorage);
startSspsPresence(document, platform, sspsPresenceEnabled);

const changeStudioPage = (page: StudioPage) => {
  window.history.replaceState(null, '', studioPageHref(window.location, page));
};

const changeSspsPresence = (enabled: boolean) => applySspsPresencePreference(
  window.localStorage,
  enabled,
  platform === 'native' ? closeNativeTerminal : async () => undefined,
  () => {
    changeStudioPage('settings');
    window.location.reload();
  },
);

createRoot(root).render(
  <StrictMode>
    <App
      initialPage={resolveInitialStudioPage(platform, window.location.hash)}
      onPageChange={changeStudioPage}
      onSspsPresenceChange={changeSspsPresence}
      platform={platform}
      sspsPresenceEnabled={sspsPresenceEnabled}
    />
  </StrictMode>,
);
