const Expo = require('../models/Expo');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const analytics = require('../services/analyticsService');
const { PUBLIC_STATUSES } = require('./expoController');

/** the dashboard is private to the organizer running the expo. */
async function loadOwnedExpo(expoId, user) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');
  if (String(expo.organizerRef) !== String(user._id)) {
    throw ApiError.forbidden('This expo belongs to another organizer');
  }
  return expo;
}

// GET /api/analytics/expo/:expoId/summary
const getSummary = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);

  const days = Math.min(Math.max(Number(req.query.days) || 14, 7), 90);
  const dashboard = await analytics.buildDashboard(expo._id, days);

  return ok(
    res,
    { ...dashboard, expo: { id: String(expo._id), title: expo.title, status: expo.status } },
    'Analytics ready'
  );
});

// GET /api/analytics/expo/:expoId/events — the raw log, newest first
const listEvents = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const filter = { expoRef: expo._id };
  if (req.query.type) filter.type = req.query.type;

  const items = await AnalyticsEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: 'userRef', select: 'name role' })
    .lean();

  return ok(res, { items: items.map((e) => ({ ...e, id: String(e._id) })) }, 'Recent activity');
});

// POST /api/analytics/events
const CLIENT_REPORTABLE = ['boothView'];

const recordEvent = asyncHandler(async (req, res) => {
  const { expoRef, type, targetRef } = req.body;

  if (!CLIENT_REPORTABLE.includes(type)) {
    throw ApiError.badRequest(`"${type}" is not an event the client may report`);
  }

  const expo = await Expo.findById(expoRef).select('status organizerRef');
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const isOwner = req.user?.role === 'organizer' && String(expo.organizerRef) === String(req.user._id);
  if (!PUBLIC_STATUSES.includes(expo.status) && !isOwner) {
    throw ApiError.notFound('That expo does not exist');
  }

  // the organizer clicking around their own floor plan is not attendee traffic.
  if (isOwner) return ok(res, { recorded: false }, 'Own activity is not counted');

  await analytics.record({
    expoRef: expo._id,
    type,
    targetRef: targetRef ?? null,
    userRef: req.user?._id ?? null,
  });

  return created(res, { recorded: true }, 'Recorded');
});

module.exports = { getSummary, listEvents, recordEvent };
