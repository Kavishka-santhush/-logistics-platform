const { Router } = require('express');
const multer = require('multer');
const c = require('../controllers/upload.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { internalOnly } = require('../middleware/role.middleware');
const { storage, fileFilter } = require('../lib/upload');

const router = Router();
router.use(requireAuth, internalOnly);

// Disk storage from lib/upload.js; the category comes from the URL param and is
// set on req before multer writes the files. Accepts multipart fields
// "file" (single) or "files" (multiple), up to 10 per request.
const setCategory = (req, _res, next) => {
  req.uploadCategory = req.params.category;
  next();
};
const parseFiles = [
  setCategory,
  multer({ storage, fileFilter, limits: { files: 10 } })
    .fields([{ name: 'file', maxCount: 10 }, { name: 'files', maxCount: 10 }]),
];

router.post('/:category', parseFiles, c.uploadByCategory);

module.exports = router;
