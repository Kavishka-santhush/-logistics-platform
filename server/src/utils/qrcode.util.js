const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs/promises');
const config = require('../config');

/**
 * Generate a tracking QR code PNG into the uploads dir and return its public URL.
 * The QR encodes the public tracking page URL for an order.
 */
async function generateTrackingQr(trackingNumber) {
  const url = `${config.clientUrl}/track/${trackingNumber}`;
  const dir = path.join(config.uploadAbsDir, 'qr');
  await fs.mkdir(dir, { recursive: true });
  const filename = `${trackingNumber}.png`;
  const filePath = path.join(dir, filename);
  await QRCode.toFile(filePath, url, { width: 512, margin: 1 });
  return { url: `${config.publicBaseUrl}/uploads/qr/${filename}`, targetUrl: url };
}

/** Return a base64 data-URL QR (used inline in label PDFs). */
async function qrDataUrl(text) {
  return QRCode.toDataURL(text, { width: 300, margin: 1 });
}

module.exports = { generateTrackingQr, qrDataUrl };
