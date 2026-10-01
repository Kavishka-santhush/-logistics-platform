const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger.util');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.smtp.host) {
    logger.warn('SMTP not configured — emails will be logged only');
    return null;
  }
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

/**
 * Send an email. `template` is an optional React-Email element; when provided
 * it is rendered to HTML. Falls back to plain text/HTML in dev without SMTP.
 */
async function sendEmail({ to, subject, template, html, text, attachments = [] }) {
  let body = { html, text };
  if (template) {
    try {
      const { render } = require('@react-email/render');
      const rendered = await render(template);
      body = { html: rendered, text: text || subject };
    } catch (err) {
      logger.warn('React Email render failed', err.message);
    }
  }

  const t = getTransporter();
  if (!t) {
    logger.info(`[email:dry-run] to=${to} subject=${subject}`);
    return { delivered: false, dryRun: true };
  }
  const info = await t.sendMail({ from: config.smtp.from, to, subject, ...body, attachments });
  logger.info(`email sent ${info.messageId} → ${to}`);
  return { delivered: true, messageId: info.messageId };
}

module.exports = { sendEmail };
