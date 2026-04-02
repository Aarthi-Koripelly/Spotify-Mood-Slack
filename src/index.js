import express from "express";
import { getRecentTracks, getTrackMetadata, refreshAccessToken } from "./spotify.js";
import { updateSlackStatus } from "./slack.js";
import { inferMood } from "./mood.js";

const app = express();
app.use(express.json());

let lastRun = null;

async function runPipeline() {
  // 1. Refresh Spotify token
  await refreshAccessToken();

  // 2. Get recently played tracks
  const tracks = await getRecentTracks(5);

  // 3. Extract metadata (name, artist, album)
  const metadata = getTrackMetadata(tracks);

  // 4. Infer mood via Claude (was missing await)
  const mood = await inferMood(metadata);

  // 5. Update Slack status + send DM with tracks
  await updateSlackStatus(mood.emoji, mood.text, metadata);

  // 6. Store result
  lastRun = {
    mood,
    tracks: metadata.map((t) => `${t.name} — ${t.artist}`),
    timestamp: new Date().toISOString(),
  };

  return lastRun;
}

app.get("/trigger", async (req, res) => {
  console.log(`[${new Date().toISOString()}] /trigger hit`);
  try {
    const result = await runPipeline();
    res.json({
      success: true,
      message: `Slack status updated to "${result.mood.emoji} ${result.mood.text}"`,
      data: result,
    });
  } catch (err) {
    console.error("Pipeline error:", err.message);
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get("/status", (req, res) => {
  if (!lastRun) {
    return res.json({ success: true, message: "No runs yet. Hit /trigger to start.", lastRun: null });
  }
  res.json({ success: true, lastRun });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Spotify Mood → Slack Status service is running." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Endpoints: GET /trigger | GET /status | GET /`);
});