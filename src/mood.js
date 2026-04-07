import fetch from "node-fetch";

export async function inferMood(tracks, anthropicKey) {
  if (!tracks || tracks.length === 0) {
    return { emoji: "🎵", text: "Listening to music" };
  }

  const trackList = tracks
    .map((t, i) => `${i + 1}. "${t.name}" by ${t.artist}`)
    .join("\n");

  const prompt = `Based on these recently played songs, infer the listener's current mood.

${trackList}

Reply with ONLY a JSON object in this exact format, no other text:
{"emoji": "<single mood emoji>", "text": "<2-4 word mood description>"}

Mood emoji examples:
🎉 pumped/euphoric
😌 chill/relaxed
😔 melancholic/sad
😤 intense/focused
🥳 celebratory/party
😍 romantic/loving
🤔 thoughtful/cerebral
😎 cool/confident
🌊 dreamy/floaty
⚡ energetic/electric
🔥 aggressive/hype
💔 heartbroken
🎵 neutral/vibing`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    console.error(`[Mood] Anthropic API error: ${res.status}`);
    return { emoji: "🎵", text: "Just vibing" };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text?.trim().replace(/```json|```/g, "").trim();

  try {
    const mood = JSON.parse(text);
    console.log(`[Mood] Inferred: ${mood.emoji} ${mood.text}`);
    return mood;
  } catch {
    console.error("[Mood] Failed to parse Claude response:", text);
    return { emoji: "🎵", text: "Just vibing" };
  }
}
