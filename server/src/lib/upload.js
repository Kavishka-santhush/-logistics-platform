const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../config');
const { badRequest } = require('../utils/response.util');

// Ensures uploads/<category>/ exists and writes files with collision-safe names.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const category = req.uploadCategory || 'misc';
    const dir = path.join(config.uploadAbsDir, category);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    cb(null, `${base}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf', 'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

function fileFilter(_req, file, cb) {
  if (ALLOWED.has(file.mimetype)) return cb(null, true);
  cb(badRequest(`Unsupported file type: ${file.mimetype}`));
}

/** Returns a Multer instance scoped to a category folder (e.g. 'vehicles', 'pod'). */
function uploader(category, { maxCount = 10 } = {}) {
  return multer({
    storage,
    fileFilter,
    limits: { fileSize: config.maxFileSizeBytes, files: maxCount },
  }).use((req, _res, next) => {
    req.uploadCategory = category;
    next();
  });
}

// Convenience pre-configured uploaders per domain
const upload = {
  logo: uploader('logos', { maxCount: 1 }),
  vehicle: uploader('vehicles'),
  driver: uploader('drivers'),
  document: uploader('documents'),
  pod: uploader('pod'), // proof of delivery
  fuel: uploader('fuel'),
  incident: uploader('incidents'),
  inspection: uploader('inspections'),
  bulk: uploader('bulk', { maxCount: 1 }),
};

module.exports = { upload, uploader, storage, fileFilter };
