require('dotenv').config();
const path = require('path');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`,

  uploadDir,
  uploadAbsDir: path.join(process.cwd(), uploadDir),
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024,

  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY,
    webhookSecret: process.env.CLERK_WEBHOOK_SECRET,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'no-reply@logistics-platform.test',
  },

  expoPushUrl: process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send',
};
