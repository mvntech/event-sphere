const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MB = 1024 * 1024;

/**
 * allow-lists, checked on BOTH mime type and extension. a browser-supplied
 * mime type is trivially spoofed, so the extension has to agree with it.
 */
const IMAGE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const DOCUMENT_TYPES = {
  ...IMAGE_TYPES,
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const LIMITS = {
  logo: { maxBytes: 2 * MB, types: IMAGE_TYPES, label: 'logo' },
  document: { maxBytes: 5 * MB, types: DOCUMENT_TYPES, label: 'document' },
};

const describe = (types) =>
  [...new Set(Object.values(types).flat())].map((e) => e.replace('.', '').toUpperCase()).join(', ');

function fileFilter(types, label) {
  return (_req, file, cb) => {
    const perField = file.fieldname === 'logo' ? LIMITS.logo : { types, label };
    const effectiveTypes = perField.types ?? types;
    const effectiveLabel = perField.label ?? label;

    const allowedExts = effectiveTypes[file.mimetype];
    if (!allowedExts) {
      return cb(
        ApiError.badRequest(
          `"${file.originalname}" is not an accepted ${effectiveLabel} type. Allowed: ${describe(effectiveTypes)}.`
        )
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      return cb(
        ApiError.badRequest(
          `"${file.originalname}" has a ${ext || 'missing'} extension that does not match its ${file.mimetype} content.`
        )
      );
    }

    return cb(null, true);
  };
}

/** files stay in memory and stream straight to cloudinary. */
function build({ maxBytes, types, label }, extra = {}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, ...extra },
    fileFilter: fileFilter(types, label),
  });
}

const MAX_DOCUMENTS = 5;

const uploadLogo = build(LIMITS.logo, { files: 1 }).single('logo');
const uploadDocuments = build(LIMITS.document, { files: MAX_DOCUMENTS }).array('documents', MAX_DOCUMENTS);

/** logo + documents in one multipart submission (the exhibitor application form). */
const uploadApplicationFiles = build(LIMITS.document, { files: MAX_DOCUMENTS + 1 }).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'documents', maxCount: MAX_DOCUMENTS },
]);

/**
 * Turns Multer's own errors into our ApiError shape so the client gets a real
 * message instead of a generic 500.
 */
function toUploadError(err) {
  if (!(err instanceof multer.MulterError)) return err;

  switch (err.code) {
    case 'LIMIT_FILE_SIZE': {
      const limit = err.field === 'logo' ? LIMITS.logo.maxBytes : LIMITS.document.maxBytes;
      return ApiError.badRequest(
        `That file is too large. The limit for ${err.field === 'logo' ? 'a logo' : 'a document'} is ${limit / MB}MB.`
      );
    }
    case 'LIMIT_FILE_COUNT':
    case 'LIMIT_UNEXPECTED_FILE':
      return ApiError.badRequest(`Too many files — you can attach at most ${MAX_DOCUMENTS} documents and 1 logo.`);
    default:
      return ApiError.badRequest(`Upload failed: ${err.message}`);
  }
}

/**
 * multer applies one `fileSize` ceiling per upload, but the logo's limit is
 * tighter than a document's. on the combined form the ceiling has to be the
 * larger of the two, so the logo is re-checked here once its size is known.
 */
function enforceLogoSize(req) {
  const logos = req.files?.logo ?? (req.file && req.file.fieldname === 'logo' ? [req.file] : []);

  for (const logo of logos) {
    if (logo.size > LIMITS.logo.maxBytes) {
      throw ApiError.badRequest(
        `That file is too large. The limit for a logo is ${LIMITS.logo.maxBytes / MB}MB.`
      );
    }
  }
}

/** wraps a multer handler so its errors reach the central error middleware correctly. */
const handleUpload = (uploader) => (req, res, next) =>
  uploader(req, res, (err) => {
    if (err) return next(toUploadError(err));
    try {
      enforceLogoSize(req);
    } catch (sizeErr) {
      return next(sizeErr);
    }
    return next();
  });

module.exports = {
  uploadLogo: handleUpload(uploadLogo),
  uploadDocuments: handleUpload(uploadDocuments),
  uploadApplicationFiles: handleUpload(uploadApplicationFiles),
  LIMITS,
  MAX_DOCUMENTS,
  MB,
};
