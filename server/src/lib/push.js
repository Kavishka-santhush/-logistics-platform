const config = require('../config');
const logger = require('../utils/logger.util');

/**
 * Send Expo push notifications to a batch of Expo push tokens.
 * Message shape follows the Expo push API.
 */
async function sendPush(tokens, { title, body, data = {}, sound = 'default', badge, channelId }) {
  const valid = (Array.isArray(tokens) ? tokens : [tokens]).filter(Boolean);
  if (!valid.length) return { sent: 0 };

  const messages = valid.map((to) => ({
    to,
    title,
    body,
    data,
    sound,
    badge,
    ...(channelId ? { channelId } : {}),
  }));

  try {
    const res = await fetch(config.expoPushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json();
    const ticketCount = Array.isArray(json.data) ? json.data.length : 0;
    logger.info(`expo push tickets=${ticketCount}`);
    return { sent: ticketCount, raw: json.data };
  } catch (err) {
    logger.warn('expo push failed', err.message);
    return { sent: 0, error: err.message };
  }
}

module.exports = { sendPush };
