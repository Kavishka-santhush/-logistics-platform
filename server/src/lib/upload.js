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

/** Returns a multipart parser for a category folder (e.g. 'vehicles', 'pod').
 * Use as [uploader('pod').middleware, uploader('pod').fields([...])] or call
 .parse* after the category is set on req by the caller. */
function uploader(category, { maxCount = 10 } = {}) {
  const instance = multer({
    storage,
    fileFilter,
    limits: { fileSize: config.maxFileSizeBytes, files: maxCount },
  });
  // diskStorage.destination reads req.uploadCategory; set it before parsing.
  const middleware = (req, _res, next) => {
    req.uploadCategory = category;
    next();
  };
  return {
    middleware,
    instance,
    single: (name) => [middleware, instance.single(name)],
    fields: (fields) => [middleware, instance.fields(fields)],
    array: (name) => [middleware, instance.array(name, maxCount)],
  };
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
