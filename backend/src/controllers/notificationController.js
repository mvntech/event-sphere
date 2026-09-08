const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

// GET /api/notifications
const listMine = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const filter = { userRef: req.user._id };
  if (req.query.unread === 'true') filter.read = false;

  const [items, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userRef: req.user._id, read: false }),
  ]);

  return ok(
    res,
    { items: items.map((n) => ({ ...n, id: String(n._id) })), unreadCount },
    'Your notifications'
  );
});

// PATCH /api/notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userRef: req.user._id },
    { $set: { read: true } },
    { new: true }
  );

  if (!notification) throw ApiError.notFound('Notification not found');
  return ok(res, { notification: notification.toJSON() }, 'Marked as read');
});

// PATCH /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userRef: req.user._id, read: false },
    { $set: { read: true } }
  );

  return ok(res, { updated: result.modifiedCount }, 'All notifications marked as read');
});

module.exports = { listMine, markRead, markAllRead };
