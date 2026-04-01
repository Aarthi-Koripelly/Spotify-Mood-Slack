import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

let accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

export async function refreshAccessToken() {
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Missing Spotify credentials. Check SPOTIFY_REFRESH_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET in .env"
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify token refresh failed: ${res.status} — ${body}`);
  }

  const data = await res.json();
  accessToken = data.access_token;
  console.log("[Spotify] Access token refreshed.");
}

export async function getRecentTracks(limit = 5) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (res.status === 401) throw new Error("Spotify token is invalid or expired. Try refreshing.");
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "unknown";
    throw new Error(`Spotify rate limit hit. Retry after ${retryAfter}s.`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify recently-played failed: ${res.status} — ${body}`);
  }

  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) throw new Error("No recent tracks found. Listen to something on Spotify first.");

  console.log(`[Spotify] Fetched ${items.length} recent tracks.`);
  return items;
}

/**
 * Extracts track name, artist, and album from recently played items.
 * Replaces the deprecated Audio Features endpoint.
 */
export function getTrackMetadata(recentTracks) {
  return recentTracks.map((item) => ({
    name: item.track.name,
    artist: item.track.artists.map((a) => a.name).join(", "),
    album: item.track.album.name,
  }));
}
