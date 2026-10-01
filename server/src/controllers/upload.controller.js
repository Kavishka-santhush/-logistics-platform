const path = require('path');
const config = require('../config');
const { h } = require('../utils/asyncHandler.util');
const { created, badRequest } = require('../utils/response.util');

// Whitelist of multer category keys defined in lib/upload.js.
const ALLOWED_CATEGORIES = new Set(['logo', 'vehicle', 'driver', 'document', 'pod', 'fuel', 'incident', 'inspection', 'bulk']);

/**
 * POST /api/uploads/:category (multipart/form-data, field name "file" or "files")
 * Stores the file(s) under uploads/<category>/ and returns server-relative URLs
 * (e.g. /uploads/pod/photo-1690000000-ab12cd34.jpg) plus absolute URLs built
 * from PUBLIC_BASE_URL. Clients store the relative url; the absolute one is a
 * convenience for previews and push payloads.
 */
const uploadByCategory = h(async (req, res) => {
  const category = req.params.category;
  if (!ALLOWED_CATEGORIES.has(category)) throw badRequest(`Unknown upload category: ${category}`);
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) throw badRequest('No file received. Use multipart field "file".');

  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const data = files.map((f) => {
    const relative = `/${uploadDir}/${category}/${path.basename(f.path)}`;
    return {
      url: relative,
      absoluteUrl: `${config.publicBaseUrl}${relative}`,
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
    };
  });
  res.status(201).json(created(data.length === 1 ? data[0] : data));
});

module.exports = { uploadByCategory };
