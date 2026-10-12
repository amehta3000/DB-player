# DB Player

Turn any shared Dropbox folder into a playlist. Paste a link and listen straight through: play, pause, skip ±10s, scrub, next and previous, shuffle and repeat, all without leaving the page. MP3, WAV, M4A, FLAC, OGG and **AIFF** are supported. AIFF works in Chrome and Firefox too, because the player converts it to WAV in the browser.

Built for producers on the go: keyboard shortcuts on desktop, a now-playing sheet on mobile, lock-screen and headphone controls through the Media Session API, and each folder remembers where you left off.

## Opening a folder

Any of these work:

| Form | Example |
| --- | --- |
| **Swap the domain** | `https://YOUR-HOST/scl/fo/l55…/AIk…?rlkey=28c…` (replace `www.dropbox.com` with your host) |
| Query param | `https://YOUR-HOST/?url=<url-encoded Dropbox link>` |
| Hash | `https://YOUR-HOST/#https://www.dropbox.com/scl/fo/…` |
| Bookmarklet | Drag **Open in DB Player** from the home page to your bookmarks bar, then click it on any Dropbox folder page |

Subfolders open in place (`&p=/Sub/Folder`). **Copy link** gives you a shareable player URL. Single-file links (`/scl/fi/…`) play with no sign-in. Try `/?demo` to use the player without Dropbox.

### Keyboard

`Space`/`K` play/pause · `J`/`L` ±10s · `←`/`→` ±5s · `N`/`P` next/prev · `0`–`9` jump to 0–90% · `S` shuffle · `R` repeat · `M` mute · `↑`/`↓` volume · `?` help

## How it reads Dropbox

Dropbox only exposes the contents of a shared folder through its API, and the API needs *some* account's token. The player supports two modes, and you can enable either one or both:

1. **Connect Dropbox (default).** Listeners click *Connect Dropbox* once (OAuth 2 PKCE). The token stays in their browser, and audio streams straight from Dropbox to the browser with seeking. No server and no secrets.
2. **Guest mode (optional).** The `/api` serverless functions use *your* Dropbox token, held server-side, to list folders and stream files. Anyone with a link can listen without signing in. The functions only accept shared links, so they can't reach anything that isn't already public to link holders. Audio is proxied through your host, so it counts toward your bandwidth.

If both are configured, signed-in listeners use their own account and everyone else uses guest mode.

## Setup

### 1. Create a Dropbox app

At <https://www.dropbox.com/developers/apps>, click **Create app**, choose **Scoped access**, and pick **Full Dropbox** (shared-link reads need it).

- **Permissions** tab: enable `files.metadata.read`, `files.content.read` and `sharing.read`, then click **Submit**.
- **Settings** tab: add your redirect URIs, which are your origin with a trailing slash, e.g. `https://your-player.vercel.app/` and `http://localhost:5173/`. Under *OAuth 2*, set **Allow public clients (Implicit Grant & PKCE)** to *Allow*.
- New apps are in development mode, which allows 500 users. Apply for production in the console once you need more.

### 2. Deploy (Vercel)

```bash
npm install
npm run dev        # http://localhost:5173 (no /api locally; use `vercel dev` for guest mode)
npm test
npm run build
```

Import the repo into Vercel. It detects Vite, and `vercel.json` rewrites every path (including `/scl/fo/…`) to the app. Set the environment variables:

| Variable | For |
| --- | --- |
| `VITE_DROPBOX_APP_KEY` | Connect Dropbox (the app key is public) |
| `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` | Guest mode (server-only) |

Any static host works for Connect-only mode (Netlify, Cloudflare Pages and similar) as long as unknown paths fall back to `index.html`.

### 3. (Guest mode) Get a refresh token

```bash
# 1) Open in a browser, approve, and copy the code it shows:
https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline

# 2) Exchange it:
curl https://api.dropboxapi.com/oauth2/token \
  -d code=THE_CODE -d grant_type=authorization_code \
  -u APP_KEY:APP_SECRET
# -> copy "refresh_token" into DROPBOX_REFRESH_TOKEN
```

## Project layout

```
src/lib/link.ts        parse Dropbox links from ?url=, #hash, or a swapped domain
src/lib/dropboxApi.ts  list shared folders (shared by browser + /api)
src/lib/auth.ts        Connect Dropbox (PKCE), token refresh
src/lib/sources.ts     connected / guest / demo sources
src/lib/aiff.ts        AIFF/AIFF-C → WAV for browsers without AIFF support
src/lib/usePlayer.ts   playback engine: queue, shuffle/repeat, fallbacks, Media Session
src/components/        landing, folder view, player bar, mobile sheet
api/                   guest-mode serverless functions (Vercel Edge)
```

DB Player is an independent project. It isn't affiliated with or endorsed by Dropbox, Inc.
