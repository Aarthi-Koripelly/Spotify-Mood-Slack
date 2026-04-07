# 🎵 Spotify Mood → Slack Status

Reads your recent Spotify listening history, infers your current mood using Claude (Anthropic), and automatically updates your Slack status with a matching emoji and message.

## What It Does

1. Fetches your last 5 tracks from the Spotify API
2. Sends the track names + artists to Claude (Haiku) to infer your current mood
3. Updates your Slack user status with a mood emoji + text (e.g. 🎉 "Feeling pumped"), expires after 1 hour

## Endpoints

| Endpoint   | Method | Description                                       |
|------------|--------|---------------------------------------------------|
| `/`        | GET    | Health check                                      |
| `/trigger` | GET    | Runs the full pipeline and updates Slack status   |
| `/status`  | GET    | Returns the result of the last pipeline run       |

## Setup

### 1. Prerequisites

- Node.js 18+
- A [Spotify Developer app](https://developer.spotify.com/dashboard) (free)
- A [Slack app](https://api.slack.com/apps) with `users.profile:write` scope (free)
- An [Anthropic API key](https://console.anthropic.com) (free tier available)

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
- `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

### 4. Authorize Spotify (one-time)

```bash
npm run auth
```

This starts a temporary server on port 8888. Open `http://127.0.0.1:8888` in your browser, log in with Spotify, and paste the returned `SPOTIFY_ACCESS_TOKEN` and `SPOTIFY_REFRESH_TOKEN` into your `.env`. You only need to do this once.

### 5. Run locally

```bash
npm start
```

The server starts on `http://localhost:3000`. Test it:

```bash
curl http://localhost:3000/trigger
```

Check Slack — your status should update immediately.

## Deployment (Railway)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all your `.env` values in Railway's Variables tab
4. Railway gives you a public URL like `https://your-app.railway.app`

Your live trigger endpoint will be:
```
https://your-app.railway.app/trigger
```

## How Mood Inference Works

Since Spotify's Audio Features endpoint is deprecated for new apps, mood is inferred by sending the track names and artists to Claude (Haiku). Claude returns a JSON object with an emoji and a short mood label:

```json
{"emoji": "🎉", "text": "Feeling pumped"}
```

If the Claude API call fails for any reason, the app falls back gracefully to `🎵 Just vibing` and does not crash.

## Error Handling

- **No recent tracks** — returns a clear error; does not update Slack
- **Spotify token expired** — automatically refreshes before every pipeline run
- **Spotify rate limit (429)** — returns 502 with the `Retry-After` value
- **Slack API error** — returns 502 with the Slack error code (e.g. `token_revoked`)
- **Claude API failure** — falls back to a default mood, pipeline continues
- **Missing env vars** — throws descriptive errors pointing to the missing variable

## Assumptions

- Uses the last 5 tracks to give Claude enough context for a reasonable mood inference
- Spotify OAuth must be completed once via `npm run auth` before running the app
- Slack status expires after 1 hour automatically (configurable in `slack.js`)
- The `/trigger` endpoint is a GET for easy browser/curl demos; in production this would be a POST with webhook signature verification
