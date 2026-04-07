# 🎵 Spotify Mood → Slack Status

Reads your recent Spotify listening history, infers your current mood using Claude (Anthropic), automatically updates your Slack status with a matching emoji and message, and sends you a Slack DM with your recent tracks. All credentials are entered via a web UI — no env vars or config files needed.

## What It Does

1. Fetches your last 5 recently played tracks from the Spotify API
2. Sends the track names + artists to Claude (Haiku) to infer your current mood
3. Updates your Slack user status with a mood emoji + text (e.g. 🎉 "Feeling pumped"), expires after 1 hour
4. Sends you a Slack DM with the inferred mood and the full list of recent tracks

## Endpoints

| Endpoint                   | Method | Description                                          |
|----------------------------|--------|------------------------------------------------------|
| `/`                        | GET    | Setup UI — connect Spotify, Slack, and Anthropic     |
| `/trigger`                 | GET    | Runs the full pipeline and updates Slack status      |
| `/status`                  | GET    | Returns connection status and last run result        |
| `/auth/spotify`            | GET    | Starts Spotify OAuth flow                            |
| `/auth/spotify/callback`   | GET    | Spotify OAuth callback                               |
| `/auth/spotify/disconnect` | GET    | Disconnects Spotify and clears session tokens        |
| `/health`                  | GET    | Health check                                         |

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Spotify Developer app](https://developer.spotify.com/dashboard) (free)
- A [Slack app](https://api.slack.com/apps) with user scopes: `users.profile:write`, `chat:write` (free)
- An [Anthropic API key](https://console.anthropic.com) (free tier available)

### 2. Spotify App Config

In your Spotify app dashboard → Edit Settings → Redirect URIs, add:
```
http://127.0.0.1:3000/auth/spotify/callback
```

### 3. Slack App Config

In your Slack app → OAuth & Permissions → User Token Scopes, add:
- `users.profile:write`
- `chat:write`

Install the app to your workspace and copy the **User OAuth Token** (starts with `xoxp-`).

### 4. Install dependencies
```bash
npm install
```

### 5. Run locally
```bash
npm start
```

**Important:** Always open `http://127.0.0.1:3000` — not `localhost:3000`. The session cookie is tied to the host, so mixing the two will break the Spotify OAuth flow.

### 6. Complete setup in the browser

Visit `http://127.0.0.1:3000` and follow the three steps:

1. **Spotify** — enter your Client ID and Client Secret from your Spotify app dashboard, click **Continue to Connect Spotify**, then click **Connect Spotify Account** and authorize in Spotify
2. **Slack** — enter your User Token (`xoxp-...`) and your User ID (`U0XXXXXXX`), click **Save Slack Credentials**
3. **Anthropic** — enter your API key (`sk-ant-...`), click **Save Anthropic Key**

Once all three show a green dot, click **Run Pipeline** — your Slack status will update immediately and you'll receive a DM with your recent tracks.

### 7. How to find each credential

**Spotify Client ID + Secret**
- Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
- Open your app and copy the Client ID and Client Secret

**Slack User Token**
- Go to [api.slack.com/apps](https://api.slack.com/apps) → your app → OAuth & Permissions
- Copy the User OAuth Token (starts with `xoxp-`)

**Slack User ID**
- In Slack, click your profile picture → ··· → **Copy member ID**
- Looks like `U0XXXXXXXXX`

**Anthropic API Key**
- Go to [console.anthropic.com](https://console.anthropic.com) → API Keys
- Create a new key (starts with `sk-ant-`)

## Deployment (Railway)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. No env vars required — all credentials are entered via the setup UI
4. Railway gives you a public URL like `https://your-app.up.railway.app`
5. Add your Railway callback URL to Spotify's Redirect URIs:
```
https://your-app.up.railway.app/auth/spotify/callback
```

Your live endpoints will be:
```
https://your-app.up.railway.app/trigger
https://your-app.up.railway.app/status
```

To trigger remotely:
```bash
curl https://spotify-mood-slack-production.up.railway.app/trigger
```

## How Mood Inference Works

Since Spotify's Audio Features endpoint is deprecated for new apps, mood is inferred by sending the track names and artists to Claude (Haiku). Claude returns a JSON object with an emoji and a short mood label:
```json
{"emoji": "🎉", "text": "Feeling pumped"}
```

If the Claude API call fails for any reason, the app falls back gracefully to `🎵 Just vibing` and does not crash.

## Error Handling

- **Missing credentials** — `/trigger` returns a clear error listing exactly which credentials are missing before making any API calls
- **No recent tracks** — returns a clear error; does not update Slack
- **Spotify token expired** — automatically refreshes before every pipeline run using the stored refresh token
- **Spotify rate limit (429)** — returns 502 with the `Retry-After` value
- **Slack API error** — returns 502 with the Slack error code (e.g. `token_revoked`)
- **Slack DM error** — logged but does not crash the pipeline; status update still succeeds
- **Claude API failure** — falls back to `🎵 Just vibing`, pipeline continues without crashing
- **Session save failure** — returns 500 with a descriptive error before any redirect happens

## Assumptions

- Uses the last 5 tracks to give Claude enough context for a reasonable mood inference
- All credentials are stored in the server session — they reset if the server restarts (use Railway env vars or a database for persistence across restarts)
- Spotify OAuth must be completed via the setup UI before hitting `/trigger`
- Slack status expires after 1 hour automatically (configurable in `slack.js`)
- `SLACK_USER_ID` is required for the DM feature — if missing, the DM is silently skipped but the status update still succeeds
- The `/trigger` endpoint is a GET for easy browser/curl demos; in production this would be a POST with webhook signature verification
- Always use `http://127.0.0.1:3000` locally, not `localhost:3000`, to ensure session cookies persist through the OAuth redirect