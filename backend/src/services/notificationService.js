const Notification = require('../models/Notification');
const { emitToUser } = require('./socketService');
const logger = require('../utils/logger');

/**
 * creates an in-app notification and pushes it to the user's socket room.
 *
 * notifications are a side effect of some other action, so a failure here is
 * logged and swallowed — a message must still send even if its notification
 * cannot be stored.
 */
async function notify({ userRef, type, message, link = '', expoRef = null }) {
  try {
    const notification = await Notification.create({ userRef, type, message, link, expoRef });

    emitToUser(userRef, 'notification:new', notification.toJSON());
    return notification;
  } catch (error) {
    logger.warn('Notification failed', { type, userRef: String(userRef), error: error.message });
    return null;
  }
}

/** same, for several recipients at once (e.g. everyone who bookmarked a session). */
async function notifyMany(userRefs, payload) {
  return Promise.all(userRefs.map((userRef) => notify({ ...payload, userRef })));
}

const unreadCount = (userRef) => Notification.countDocuments({ userRef, read: false });

module.exports = { notify, notifyMany, unreadCount };
