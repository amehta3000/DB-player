// "Connect Dropbox" via OAuth 2 PKCE — no server, no secret. Tokens live only in this browser.

const APP_KEY: string | undefined = import.meta.env.VITE_DROPBOX_APP_KEY;
const STORE_KEY = 'dbp.auth';
const PENDING_KEY = 'dbp.oauth';

interface StoredAuth {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

interface Pending {
  verifier: string;
  state: string;
  returnTo: string;
}

export const canConnect = Boolean(APP_KEY);

function redirectUri(): string {
  return `${location.origin}/`;
}

function load(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

function save(auth: StoredAuth | null) {
  try {
    if (auth) localStorage.setItem(STORE_KEY, JSON.stringify(auth));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable: session-only */
  }
}

export function isConnected(): boolean {
  return Boolean(APP_KEY && load());
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 48): string {
  return b64url(crypto.getRandomValues(new Uint8Array(len)));
}

export async function startConnect(returnTo: string): Promise<void> {
  if (!APP_KEY) throw new Error('No Dropbox app key configured');
  const verifier = randomString(64);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const state = randomString(16);
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state, returnTo } satisfies Pending));
  const q = new URLSearchParams({
    client_id: APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri(),
    token_access_type: 'offline',
    state,
  });
  location.assign(`https://www.dropbox.com/oauth2/authorize?${q}`);
}

async function tokenRequest(params: Record<string, string>): Promise<StoredAuth> {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: APP_KEY!, ...params }),
  });
  if (!res.ok) throw new Error('Dropbox sign-in failed. Please try again.');
  const j = await res.json();
  return {
    accessToken: j.access_token,
    expiresAt: Date.now() + (j.expires_in ?? 14400) * 1000,
    refreshToken: j.refresh_token ?? params.refresh_token,
  };
}

/**
 * If this page load is the OAuth redirect, finish sign-in and return the URL the
 * user was on before connecting. Otherwise returns null.
 */
let completing: Promise<string | null> | null = null;
export function completeConnect(): Promise<string | null> {
  // Memoized: the code is single-use, and React StrictMode runs effects twice in dev.
  return (completing ??= doCompleteConnect());
}

async function doCompleteConnect(): Promise<string | null> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const state = q.get('state');
  const err = q.get('error');
  if (!code && !err) return null;

  let pending: Pending | null = null;
  try {
    pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
  } catch {
    /* ignore */
  }
  sessionStorage.removeItem(PENDING_KEY);
  const returnTo = pending?.returnTo ?? '/';
  if (err || !pending || pending.state !== state) return returnTo;

  save(await tokenRequest({ grant_type: 'authorization_code', code: code!, code_verifier: pending.verifier, redirect_uri: redirectUri() }));
  return returnTo;
}

let refreshing: Promise<StoredAuth> | null = null;

/** A valid access token, refreshing it if it's about to expire. */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  const auth = load();
  if (!auth) throw new Error('Not connected to Dropbox');
  if (!forceRefresh && auth.expiresAt - 120_000 > Date.now()) return auth.accessToken;
  if (!auth.refreshToken) {
    save(null);
    throw new Error('Your Dropbox session expired. Reconnect to continue.');
  }
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refreshToken }).finally(() => {
    refreshing = null;
  });
  const next = await refreshing;
  save(next);
  return next.accessToken;
}

export function disconnect() {
  const auth = load();
  save(null);
  if (auth) {
    fetch('https://api.dropboxapi.com/2/auth/token/revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    }).catch(() => {});
  }
}
