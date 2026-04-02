# 🎵 Spotify Mood → Slack Status

Reads your recent Spotify listening history, infers your current mood using Claude (Anthropic), automatically updates your Slack status, and sends you a DM with your recent tracks.

## What It Does

1. Fetches your last 5 tracks from the Spotify API
2. Sends the track names + artists to Claude (Haiku) to infer your current mood
3. Updates your Slack user status with a mood emoji + text (e.g. 🎉 "Feeling pumped"), expires after 1 hour
4. Sends you a Slack DM with the inferred mood and the list of recent tracks

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/trigger` | GET | Runs the full pipeline and updates Slack status |
| `/status` | GET | Returns the result of the last pipeline run |

## Setup

### 1. Prerequisites
- Node.js 18+
- A [Spotify Developer app](https://developer.spotify.com/dashboard) (free)
- A [Slack app](https://api.slack.com/apps) with `users.profile:write` and `chat:write` scopes (free)
- An [Anthropic API key](https://console.anthropic.com)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Fill in:
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — from your Spotify app dashboard
- `SLACK_USER_TOKEN` — the **User OAuth Token** (starts with `xoxp-`), not the Bot token
- `SLACK_USER_ID` — your Slack member ID (click your profile → three dots → Copy member ID, looks like `U0XXXXXXXXX`)
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

### 4. Authorize Spotify (one-time)
```bash
npm run auth
```
Starts a temporary server on port 8888. Open `http://127.0.0.1:8888` in your browser, log in with Spotify, and paste the returned `SPOTIFY_ACCESS_TOKEN` and `SPOTIFY_REFRESH_TOKEN` into your `.env`. You only need to do this once.

### 5. Run locally
```bash
npm start
```
Server starts on `http://localhost:3000`. Test it:
```bash
curl http://localhost:3000/trigger
```
Check Slack — your status should update and you should receive a DM with your recent tracks.

## Deployment (Railway)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all your `.env` values in Railway's Variables tab
4. Railway gives you a public URL like `https://your-app.railway.app/trigger`

## How Mood Inference Works

Mood is inferred by sending the track names and artists to Claude (Haiku). Claude returns a JSON object with an emoji and a short mood label:
```json
{"emoji": "🎉", "text": "Feeling pumped"}
```
If the Claude API call fails for any reason, the app falls back gracefully to `🎵 Just vibing` and does not crash.

## Error Handling

- **No recent tracks** — returns a clear error; does not update Slack
- **Spotify token expired** — automatically refreshes before every pipeline run
- **Spotify rate limit (429)** — returns 502 with the `Retry-After` value
- **Slack API error** — returns 502 with the Slack error code (e.g. `token_revoked`)
- **Slack DM error** — logged but does not crash the pipeline; status update still succeeds
- **Claude API failure** — falls back to a default mood, pipeline continues
- **Missing env vars** — throws descriptive errors pointing to the missing variable

## Assumptions

- Uses the last 5 tracks to give Claude enough context for a reasonable mood inference
- Spotify OAuth must be completed once via `npm run auth` before running the app
- Slack status expires after 1 hour automatically (configurable in `slack.js`)
- `SLACK_USER_ID` must be set for the DM feature to work; if missing, DM is silently skipped
- The `/trigger` endpoint is a GET for easy browser/curl demos; in production this would be a POST with webhook signature verification

## Live Deployment

Trigger endpoint: `https://spotify-mood-slack-production.up.railway.app/trigger`
Status endpoint: `https://spotify-mood-slack-production.up.railway.app/status`

To trigger remotely:
```bash
curl https://spotify-mood-slack-production.up.railway.app/trigger
```