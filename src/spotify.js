import fetch from "node-fetch";

let accessToken = null;

/**
 * Refreshes the Spotify access token.
 * Accepts credentials as arguments so they can come from the UI or env.
 */
export async function refreshAccessToken(clientId, clientSecret, refreshToken, onNewToken) {
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
  if (onNewToken) onNewToken(accessToken);
  console.log("[Spotify] Access token refreshed.");
}

/**
 * Fetches recently played tracks using the provided access token.
 */
export async function getRecentTracks(token, limit = 5) {
  const res = await fetch(
    `https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 401) throw new Error("Spotify token invalid or expired.");
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
  if (items.length === 0) throw new Error("No recent tracks found on Spotify.");

  console.log(`[Spotify] Fetched ${items.length} recent tracks.`);
  return items;
}

/**
 * Extracts track name, artist, album from recently played items.
 */
export function getTrackMetadata(recentTracks) {
  return recentTracks.map((item) => ({
    name: item.track.name,
    artist: item.track.artists.map((a) => a.name).join(", "),
    album: item.track.album.name,
  }));
}
