const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const ROOT_FOLDER = 'eventsphere';

function assertConfigured() {
  if (!isCloudinaryConfigured()) {
    throw ApiError.internal('File storage is not configured on this server. Set CLOUDINARY_* and restart.');
  }
}

/** cloudinary wants "image" for renderable files and "raw" for PDFs/Word docs. */
const resourceTypeFor = (mimeType) => (mimeType.startsWith('image/') ? 'image' : 'raw');

/** strips the extension and anything Cloudinary would choke on in a public_id. */
const safeName = (filename) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';

/**
 * streams a Multer memory buffer into Cloudinary.
 * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} file
 * @param {{folder: string, transformation?: object[]}} options
 */
function uploadBuffer(file, { folder, transformation }) {
  assertConfigured();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${ROOT_FOLDER}/${folder}`,
        resource_type: resourceTypeFor(file.mimetype),
        public_id: `${Date.now()}-${safeName(file.originalname)}`,
        overwrite: false,
        ...(transformation ? { transformation } : {}),
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed', { file: file.originalname, message: error.message });
          return reject(ApiError.badRequest(`Could not store "${file.originalname}". Please try again.`));
        }
        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
          filename: file.originalname,
          mimeType: file.mimetype,
          bytes: result.bytes ?? file.size,
          resourceType: result.resource_type,
        });
      }
    );

    stream.end(file.buffer);
  });
}

/** logos are normalized to a square-ish capped size so cards never blow up. */
const uploadLogo = (file) =>
  uploadBuffer(file, {
    folder: 'logos',
    transformation: [{ width: 512, height: 512, crop: 'limit' }, { quality: 'auto' }],
  });

const uploadDocument = (file) => uploadBuffer(file, { folder: 'documents' });

/** best-effort cleanup — a failed delete must never fail the user's request. */
async function destroyAsset(publicId, resourceType = 'raw') {
  if (!publicId || !isCloudinaryConfigured()) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    logger.warn('Could not delete Cloudinary asset', { publicId, message: err.message });
  }
}

module.exports = { uploadLogo, uploadDocument, uploadBuffer, destroyAsset, isCloudinaryConfigured };
