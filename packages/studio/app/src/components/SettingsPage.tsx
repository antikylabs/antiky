import { useState } from 'react';

type SettingsPageProps = Readonly<{
  sspsPresenceEnabled: boolean;
  onSspsPresenceChange(enabled: boolean): boolean;
}>;

export function SettingsPage({
  sspsPresenceEnabled,
  onSspsPresenceChange,
}: SettingsPageProps) {
  const [saveFailed, setSaveFailed] = useState(false);

  const changePresence = () => {
    setSaveFailed(false);
    if (!onSspsPresenceChange(!sspsPresenceEnabled)) setSaveFailed(true);
  };

  return (
    <section aria-labelledby="settings-title" className="settings-page">
      <div className="settings-page-inner">
        <header className="settings-heading">
          <span>Studio preferences</span>
          <h1 id="settings-title">Settings</h1>
          <p>Control local Studio behavior. These preferences stay on this device.</p>
        </header>

        <section aria-labelledby="online-presence-title" className="settings-section">
          <div className="settings-section-heading">
            <span>Privacy</span>
            <h2 id="online-presence-title">Online presence signal</h2>
          </div>
          <div className="setting-row">
            <div>
              <h3>Share online presence</h3>
              <p id="online-presence-description">
                SSPS receives only the signal needed to count this Studio instance as online.
                Antiky does not send project names, commands, activity, or usage information through
                this signal. It only helps display the active-user count on the Antiky website.
              </p>
              <p className="setting-reload-note">
                Changing this setting reloads Studio so the signal starts or stops immediately.
              </p>
              {saveFailed && (
                <p className="setting-error" role="alert">
                  Studio could not save this preference. Close Studio to stop the current signal.
                  Online presence stays off on launches where local preference storage is unavailable.
                </p>
              )}
            </div>
            <button
              aria-checked={sspsPresenceEnabled}
              aria-describedby="online-presence-description"
              aria-label="Share online presence"
              className="setting-switch"
              onClick={changePresence}
              role="switch"
              type="button"
            >
              <span aria-hidden="true" className="setting-switch-track">
                <span className="setting-switch-thumb" />
              </span>
              <span>{sspsPresenceEnabled ? 'On' : 'Off'}</span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
