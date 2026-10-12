import { canConnect, startConnect } from '../lib/auth';
import { ExternalIcon } from './Icons';

export function ConnectGate({ dropboxUrl }: { dropboxUrl: string }) {
  return (
    <main className="gate">
      <section className="panel gate-card">
        <div className="gate-art" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1>Connect Dropbox to open this folder</h1>
        <p>
          Dropbox only lets apps read a shared folder on behalf of a signed-in account. Connect once and any shared link opens instantly — your sign-in stays in
          this browser and is only used to read links you open.
        </p>
        {canConnect ? (
          <button className="btn primary big" onClick={() => startConnect(location.pathname + location.search + location.hash)}>
            Connect Dropbox
          </button>
        ) : (
          <p className="setup-note">
            This copy of DB Player isn’t set up yet. The host needs to add a Dropbox app key (<code>VITE_DROPBOX_APP_KEY</code>) or enable guest mode — see the
            README.
          </p>
        )}
        <div className="gate-alt">
          <a href={dropboxUrl} target="_blank" rel="noreferrer">
            Open in Dropbox instead <ExternalIcon size={14} />
          </a>
          <span>·</span>
          <a href="/?demo">Try the demo</a>
        </div>
      </section>
    </main>
  );
}
