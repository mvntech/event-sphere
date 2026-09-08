const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Expo = require('../models/Expo');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const { notify } = require('../services/notificationService');
const { sendOrganizerDecisionEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// user and role management

const PUBLIC_FIELDS = 'name email role avatarUrl consentGiven organizerApprovalStatus organizerReviewedAt createdAt';

// GET /api/users
const listUsers = asyncHandler(async (req, res) => {
  const { role, status, search } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const filter = {};
  if (role) filter.role = role;
  if (status === 'pending') filter.organizerApprovalStatus = 'pending';
  if (status === 'rejected') filter.organizerApprovalStatus = 'rejected';
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [items, total, roleCounts, pendingOrganizers] = await Promise.all([
    User.find(filter).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ role: 'organizer', organizerApprovalStatus: 'pending' }),
  ]);

  const counts = { organizer: 0, exhibitor: 0, attendee: 0 };
  roleCounts.forEach((row) => {
    counts[row._id] = row.count;
  });

  return ok(
    res,
    {
      items,
      counts: { ...counts, pendingOrganizers },
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    },
    'Users'
  );
});

/**
 * PATCH /api/users/:id/organizer-status
 * approve or reject a pending organizer.
 */
const reviewOrganizer = asyncHandler(async (req, res) => {
  const { organizerApprovalStatus, reviewNote } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('That user does not exist');
  if (user.role !== 'organizer') throw ApiError.badRequest('Only organizer accounts need approval');

  if (String(user._id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot review your own account');
  }

  user.organizerApprovalStatus = organizerApprovalStatus;
  user.organizerReviewedBy = req.user._id;
  user.organizerReviewedAt = new Date();
  await user.save();

  const approved = organizerApprovalStatus === 'approved';

  // email is a side effect — a mail outage must not fail the review.
  sendOrganizerDecisionEmail({
    to: user.email,
    name: user.name,
    approved,
    note: reviewNote,
  }).catch((err) => logger.warn('Organizer decision email failed', { message: err.message }));

  await notify({
    userRef: user._id,
    type: approved ? 'exhibitor-approved' : 'exhibitor-rejected',
    message: approved
      ? 'Your organizer account has been approved — you can sign in now'
      : 'Your organizer account request was not approved',
    link: '/login',
  });

  logger.info('Organizer reviewed', { userId: String(user._id), organizerApprovalStatus });

  return ok(res, { user: user.toPublic() }, `Organizer ${organizerApprovalStatus}`);
});

/**
 * PATCH /api/users/:id/role
 * moves someone between roles. guarded so the change can never orphan data or
 * lock the last organizer out.
 */
const changeRole = asyncHandler(async (req, res) => {
  const { role } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('That user does not exist');

  if (String(user._id) === String(req.user._id)) {
    throw ApiError.badRequest('You cannot change your own role');
  }
  if (user.role === role) return ok(res, { user: user.toPublic() }, 'Role unchanged');

  // demoting an organizer who still runs expos would orphan those events.
  if (user.role === 'organizer') {
    const expoCount = await Expo.countDocuments({ organizerRef: user._id });
    if (expoCount > 0) {
      throw ApiError.conflict(
        `${user.name} still runs ${expoCount} expo${expoCount === 1 ? '' : 's'}. Reassign or delete those first.`
      );
    }

    const remaining = await User.countDocuments({
      role: 'organizer',
      _id: { $ne: user._id },
      $or: [{ organizerApprovalStatus: 'approved' }, { organizerApprovalStatus: null }],
    });
    if (remaining === 0) throw ApiError.conflict('This is the last active organizer — promote someone else first.');
  }

  // an exhibitor with applications would lose access to them.
  if (user.role === 'exhibitor') {
    const profileCount = await ExhibitorProfile.countDocuments({ userRef: user._id });
    if (profileCount > 0) {
      throw ApiError.conflict(
        `${user.name} has ${profileCount} exhibitor application${profileCount === 1 ? '' : 's'}. Remove those first.`
      );
    }
  }

  user.role = role;
  // someone promoted to organizer by an existing organizer is approved by that act.
  user.organizerApprovalStatus = role === 'organizer' ? 'approved' : null;
  user.organizerReviewedBy = role === 'organizer' ? req.user._id : null;
  user.organizerReviewedAt = role === 'organizer' ? new Date() : null;
  await user.save();

  await notify({
    userRef: user._id,
    type: 'exhibitor-approved',
    message: `An organizer changed your account type to ${role}`,
    link: `/${role}`,
  });

  logger.info('Role changed', { userId: String(user._id), role });
  return ok(res, { user: user.toPublic() }, `${user.name} is now a ${role}`);
});

module.exports = { listUsers, reviewOrganizer, changeRole };
