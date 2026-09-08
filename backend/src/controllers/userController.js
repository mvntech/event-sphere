const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const privacyService = require('../services/privacyService');

// GET /api/users/me
const getMe = asyncHandler(async (req, res) => ok(res, { user: req.user.toPublic() }, 'Profile loaded'));

// PATCH /api/users/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, avatarUrl, notificationPrefs } = req.body;

  if (name !== undefined) req.user.name = name;
  if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;
  if (notificationPrefs) {
    req.user.notificationPrefs = { ...req.user.notificationPrefs.toObject?.() ?? req.user.notificationPrefs, ...notificationPrefs };
  }

  await req.user.save();
  return ok(res, { user: req.user.toPublic() }, 'Profile updated');
});

/** GET /api/users/me/export — everything we hold, as a JSON download. */
const exportMe = asyncHandler(async (req, res) => {
  const data = await privacyService.exportUserData(req.user._id);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eventsphere-data-${stamp}.json"`);
  return res.status(200).send(JSON.stringify(data, null, 2));
});

/** GET /api/users/me/deletion-check — what would block deleting this account. */
const deletionCheck = asyncHandler(async (req, res) => {
  const blockers = await privacyService.deletionBlockers(req.user);
  return ok(res, { canDelete: blockers.length === 0, blockers }, 'Deletion check');
});

/** DELETE /api/users/me — anonymise now, purge after the retention window. */
const deleteMe = asyncHandler(async (req, res) => {
  const result = await privacyService.anonymizeUser(req.user._id);
  return ok(
    res,
    result,
    `Your account has been anonymised. The remaining record is deleted after ${result.retentionDays} days.`
  );
});

module.exports = { getMe, updateMe, exportMe, deletionCheck, deleteMe };
