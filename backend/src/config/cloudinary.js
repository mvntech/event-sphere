const { v2: cloudinary } = require('cloudinary');
const env = require('./env');
const logger = require('../utils/logger');

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  logger.warn(
    'Cloudinary is not configured — file uploads will be rejected. Set CLOUDINARY_* in backend/.env.'
  );
}

module.exports = { cloudinary, isCloudinaryConfigured: () => isConfigured };
