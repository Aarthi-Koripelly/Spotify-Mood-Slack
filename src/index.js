import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { getRecentTracks, getTrackMetadata } from "./spotify.js";
import { updateSlackStatus } from "./slack.js";
import { inferMood } from "./mood.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-prod",
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false, sameSite: "lax" },
  })
);

function getCreds(req) {
  return req.session.credentials || {};
}

function checkCredentials(req) {
  const c = getCreds(req);
  const missing = [];
  if (!c.spotify_refresh_token) missing.push("spotify");
  if (!c.slack_user_token) missing.push("slack_user_token");
  if (!c.slack_user_id) missing.push("slack_user_id");
  if (!c.anthropic_api_key) missing.push("anthropic_api_key");
  return missing;
}

app.post("/credentials", (req, res) => {
  if (!req.session.credentials) req.session.credentials = {};
  const allowed = [
    "spotify_client_id", "spotify_client_secret",
    "slack_user_token", "slack_user_id",
    "anthropic_api_key",
  ];
  for (const key of allowed) {
    if (req.body[key]) req.session.credentials[key] = req.body[key];
  }
  console.log("[Credentials] Updated:", Object.keys(req.body).join(", "));
  console.log("[Session] credentials keys:", Object.keys(req.session.credentials));
  req.session.save((err) => {
    if (err) {
      console.error("[Session] Save error:", err);
      return res.status(500).json({ success: false, error: "Session save failed" });
    }
    res.json({ success: true });
  });
});

app.get("/auth/spotify", (req, res) => {
  console.log("[Auth] Session credentials keys:", Object.keys(req.session.credentials || {}));
  const c = getCreds(req);
  const clientId = c.spotify_client_id;

  if (!clientId) {
    console.log("[Auth] No client ID found in session");
    return res.redirect("/?error=missing_spotify_credentials");
  }

  console.log("[Auth] Redirecting with clientId:", clientId.slice(0, 6) + "...");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: "http://127.0.0.1:3000/auth/spotify/callback",
    scope: "user-read-recently-played user-read-private",
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

app.get("/auth/spotify/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect("/?error=spotify_denied");

  const c = getCreds(req);
  const clientId = c.spotify_client_id;
  const clientSecret = c.spotify_client_secret;

  if (!clientId || !clientSecret) return res.redirect("/?error=missing_spotify_credentials");

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: "http://127.0.0.1:3000/auth/spotify/callback",
      }),
    });

    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
    const data = await tokenRes.json();

    req.session.credentials.spotify_access_token = data.access_token;
    req.session.credentials.spotify_refresh_token = data.refresh_token;

    req.session.save((err) => {
      if (err) console.error("[Session] Save error after OAuth:", err);
      console.log("[Spotify] OAuth complete.");
      res.redirect("/?spotify=connected");
    });
  } catch (err) {
    console.error("Spotify callback error:", err.message);
    res.redirect("/?error=spotify_failed");
  }
});

app.get("/auth/spotify/disconnect", (req, res) => {
  if (req.session.credentials) {
    delete req.session.credentials.spotify_access_token;
    delete req.session.credentials.spotify_refresh_token;
    delete req.session.credentials.spotify_client_id;
    delete req.session.credentials.spotify_client_secret;
  }
  req.session.save(() => res.redirect("/"));
});

async function refreshSpotifyToken(req) {
  const c = getCreds(req);
  if (!c.spotify_refresh_token) throw new Error("Spotify not connected.");
  if (!c.spotify_client_id || !c.spotify_client_secret) throw new Error("Missing Spotify client credentials.");

  const basic = Buffer.from(`${c.spotify_client_id}:${c.spotify_client_secret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: c.spotify_refresh_token,
    }),
  });

  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const data = await res.json();
  req.session.credentials.spotify_access_token = data.access_token;
  return data.access_token;
}

async function runPipeline(req) {
  const missing = checkCredentials(req);
  if (missing.length > 0) {
    throw new Error(`Missing credentials: ${missing.join(", ")}. Complete setup first.`);
  }

  const accessToken = await refreshSpotifyToken(req);
  const tracks = await getRecentTracks(accessToken, 5);
  const metadata = getTrackMetadata(tracks);

  const c = getCreds(req);
  const mood = await inferMood(metadata, c.anthropic_api_key);
  await updateSlackStatus(c.slack_user_token, c.slack_user_id, mood.emoji, mood.text, metadata);

  return {
    mood,
    tracks: metadata.map((t) => `${t.name} — ${t.artist}`),
    timestamp: new Date().toISOString(),
  };
}

app.get("/trigger", async (req, res) => {
  console.log(`[${new Date().toISOString()}] /trigger hit`);
  try {
    const result = await runPipeline(req);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Pipeline error:", err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get("/status", (req, res) => {
  const c = getCreds(req);
  res.json({
    success: true,
    saved: {
      spotify: !!c.spotify_refresh_token,
      spotify_credentials: !!(c.spotify_client_id && c.spotify_client_secret),
      slack: !!(c.slack_user_token && c.slack_user_id),
      anthropic: !!c.anthropic_api_key,
    },
  });
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open: http://127.0.0.1:${PORT}`);
});