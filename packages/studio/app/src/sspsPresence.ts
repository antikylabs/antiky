export const SSPS_PRESENCE_STORAGE_KEY = 'antiky:studio:ssps-presence';
export const SSPS_VISITOR_STORAGE_KEY = 'ssps:visitor-id';
export const SSPS_SCRIPT_URL = 'https://usessps.com/ssps.js';
export const SSPS_SITE_ID = '268';

type PresencePlatform = 'browser' | 'native';
type PresenceStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function readSspsPresenceEnabled(storage: PresenceStorage): boolean {
  try {
    return storage.getItem(SSPS_PRESENCE_STORAGE_KEY) !== 'disabled';
  } catch {
    return false;
  }
}

export function writeSspsPresenceEnabled(
  storage: PresenceStorage,
  enabled: boolean,
): boolean {
  try {
    storage.setItem(SSPS_PRESENCE_STORAGE_KEY, enabled ? 'enabled' : 'disabled');
  } catch {
    return false;
  }

  if (!enabled) {
    try {
      storage.removeItem(SSPS_VISITOR_STORAGE_KEY);
    } catch {
      // The opt-out is saved. A stale local ID cannot send data by itself.
    }
  }
  return true;
}

export function startSspsPresence(
  document: Document,
  platform: PresencePlatform,
  enabled: boolean,
): boolean {
  if (platform !== 'native' || !enabled) return false;

  const selector = `script[src="${SSPS_SCRIPT_URL}"][data-site-id="${SSPS_SITE_ID}"]`;
  if (document.querySelector(selector)) return true;

  const script = document.createElement('script');
  script.async = true;
  script.src = SSPS_SCRIPT_URL;
  script.dataset.siteId = SSPS_SITE_ID;
  document.head.append(script);
  return true;
}
