import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const slackToken = process.env.SLACK_USER_TOKEN;

export async function updateSlackStatus(emoji, text) {
  if (!slackToken) {
    throw new Error("Missing SLACK_USER_TOKEN in .env");
  }

  // Split combined emoji e.g. "🎉🇧🇷" into mood emoji and flag
  const parts = [...emoji];
  const moodEmoji = parts[0];
  const flagEmoji = parts[1] || "";

  const slackEmoji = emojiToSlackCode(moodEmoji);
  const statusText = flagEmoji ? `${text} ${flagEmoji}` : text;

  // Status expires in 1 hour from now
  const expiration = Math.floor(Date.now() / 1000) + 3600;

  const profile = {
    status_text: statusText,
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

  console.log(`[Slack] Status updated → ${slackEmoji} ${statusText}`);
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