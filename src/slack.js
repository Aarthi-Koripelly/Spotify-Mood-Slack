import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const slackToken = process.env.SLACK_USER_TOKEN;
const slackUserId = process.env.SLACK_USER_ID;

export async function updateSlackStatus(emoji, text, tracks = []) {
  if (!slackToken) {
    throw new Error("Missing SLACK_USER_TOKEN in .env");
  }

  const slackEmoji = emojiToSlackCode(emoji);

  // Status expires in 1 hour from now
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  const profile = {
    status_text: text,
    status_emoji: slackEmoji,
    status_expiration: expiration,
  };

  const res = await fetch("https://slack.com/api/users.profile.set", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profile }),
  });

  if (!res.ok) {
    throw new Error(`Slack API HTTP error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  console.log(`[Slack] Status updated → ${slackEmoji} ${text}`);

  // Send DM to yourself with the recent tracks
  if (tracks.length > 0 && slackUserId) {
    await sendTracksDM(emoji, text, tracks);
  }
}

async function sendTracksDM(emoji, mood, tracks) {
  const trackList = tracks
    .map((t, i) => `${i + 1}. *${t.name}* — ${t.artist}`)
    .join("\n");

  const message = `${emoji} *Mood updated: ${mood}*\n\nRecent tracks:\n${trackList}`;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: slackUserId, // DMing yourself by passing your own user ID
      text: message,
    }),
  });

  if (!res.ok) {
    console.error(`[Slack] DM HTTP error: ${res.status}`);
    return;
  }

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