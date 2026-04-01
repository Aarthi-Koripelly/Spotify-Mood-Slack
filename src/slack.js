import fetch from "node-fetch";
import * as dotenv from "dotenv";
dotenv.config();

const slackToken = process.env.SLACK_USER_TOKEN;

/**
 * Updates the Slack user status with a given emoji and text.
 *
 * NOTE: This requires a *User* OAuth token (not a Bot token), because
 * Slack's users.profile.set API updates the calling user's own status.
 * Scope needed: users.profile:write
 *
 * Status expires after 1 hour automatically (expiration set below).
 *
 * @param {string} emoji - Slack emoji string e.g. ":musical_note:"
 * @param {string} text  - Status text e.g. "Feeling pumped"
 */
export async function updateSlackStatus(emoji, text) {
  if (!slackToken) {
    throw new Error("Missing SLACK_USER_TOKEN in .env");
  }

  // Convert plain emoji characters to Slack emoji codes if needed
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

  // Slack always returns 200 but signals errors in the body
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  console.log(`[Slack] Status updated → ${slackEmoji} ${text}`);
}

/**
 * Maps plain Unicode emoji to Slack emoji codes.
 * Extend this map as needed for your mood set.
 */
function emojiToSlackCode(emoji) {
  // Handle flag emojis dynamically (e.g. 🇧🇷 → :flag-br:)
  const flagMatch = emoji.match(/[\u{1F1E0}-\u{1F1FF}]{2}/u);
  if (flagMatch) {
    const flag = flagMatch[0];
    const code = [...flag]
      .map(c => String.fromCharCode(c.codePointAt(0) - 0x1F1E6 + 97))
      .join("");
    return emoji.replace(flag, `:flag-${code}:`);
  }

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
  };
  return map[emoji] || ":musical_note:";
}