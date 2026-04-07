import fetch from "node-fetch";

export async function updateSlackStatus(slackToken, slackUserId, emoji, text, tracks = []) {
  const slackEmoji = emojiToSlackCode(emoji);
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  const res = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile: {
        status_text: text,
        status_emoji: slackEmoji,
        status_expiration: expiration,
      },
    }),
  });

  if (!res.ok) throw new Error(`Slack API HTTP error: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

  console.log(`[Slack] Status updated → ${slackEmoji} ${text}`);

  if (tracks.length > 0 && slackUserId) {
    await sendTracksDM(slackToken, slackUserId, emoji, text, tracks);
  }
}

async function sendTracksDM(slackToken, slackUserId, emoji, mood, tracks) {
  const trackList = tracks
    .map((t, i) => `${i + 1}. *${t.name}* — ${t.artist}`)
    .join("\n");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: slackUserId,
      text: `${emoji} *Mood updated: ${mood}*\n\nRecent tracks:\n${trackList}`,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error(`[Slack] DM error: ${data.error}`);
    return;
  }
  console.log(`[Slack] DM sent with recent tracks.`);
}

function emojiToSlackCode(emoji) {
  const map = {
    "🎉": ":tada:",
    "😊": ":slightly_smiling_face:",
    "😤": ":triumph:",
    "😔": ":pensive:",
    "🎵": ":musical_note:",
    "😌": ":relieved:",
    "🔥": ":fire:",
    "💤": ":zzz:",
    "🥳": ":partying_face:",
    "😍": ":heart_eyes:",
    "🤔": ":thinking_face:",
    "😎": ":sunglasses:",
    "🌊": ":ocean:",
    "⚡": ":zap:",
    "💔": ":broken_heart:",
    "🕺": ":man_dancing:",
  };
  return map[emoji] || ":musical_note:";
}
