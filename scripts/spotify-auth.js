/**
 * One-time Spotify OAuth Setup Script
 * ------------------------------------
 * Run this ONCE to get your refresh_token, then paste it into .env.
 * You never need to run this again — the main app handles token refresh automatically.
 *
 * Usage:
 *   node scripts/spotify-auth.js
 *   Then open the printed URL in your browser and complete the OAuth flow.
 */

import express from "express";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = "http://127.0.0.1:8888/callback";
const SCOPES = "user-read-recently-played";

if (!clientId || !clientSecret) {
  console.error("❌ Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const app = express();

// Step 1: Redirect user to Spotify's auth page
app.get("/", (req, res) => {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// Step 2: Spotify redirects back here with a code; exchange it for tokens
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.send("❌ No code returned from Spotify.");
  }

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
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();

  if (!data.refresh_token) {
    return res.send(`❌ Token exchange failed: ${JSON.stringify(data)}`);
  }

  console.log("\n✅ Success! Add these to your .env file:\n");
  console.log(`SPOTIFY_ACCESS_TOKEN=${data.access_token}`);
  console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}`);

  res.send(`
    <h2>✅ Authorization complete!</h2>
    <p>Copy these into your <code>.env</code> file:</p>
    <pre>
SPOTIFY_ACCESS_TOKEN=${data.access_token}
SPOTIFY_REFRESH_TOKEN=${data.refresh_token}
    </pre>
    <p>You can close this window.</p>
  `);

  // Shut down the temporary server
  setTimeout(() => process.exit(0), 2000);
});

app.listen(8888, () => {
  console.log("🎵 Spotify Auth Setup");
  console.log("─────────────────────────────────────────");
  console.log("Open this URL in your browser to authorize:");
  console.log("👉  http://localhost:8888");
  console.log("─────────────────────────────────────────");
});
