const Session = require('../models/Session');
const Expo = require('../models/Expo');
const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { assertCapacityFitsExisting } = require('../services/registrationService');
const { PUBLIC_STATUSES } = require('./expoController');

/** loads the expo behind a session and checks the caller organizes it. */
async function loadOwnedExpo(expoId, user) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');
  if (String(expo.organizerRef) !== String(user._id)) {
    throw ApiError.forbidden('This expo belongs to another organizer');
  }
  return expo;
}

/** a session outside its expo's dates is almost always a typo — catch it early. */
function assertWithinExpo(expo, startTime, endTime) {
  const dayStart = new Date(expo.startDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(expo.endDate);
  dayEnd.setHours(23, 59, 59, 999);

  if (startTime < dayStart || endTime > dayEnd) {
    throw ApiError.badRequest(
      `Sessions must fall between ${dayStart.toDateString()} and ${dayEnd.toDateString()} — the expo's own dates.`,
      [{ field: 'startTime', message: 'Outside the expo dates' }]
    );
  }
}

// GET /api/sessions/expo/:expoId
const listByExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.findById(req.params.expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const isOwner = req.user?.role === 'organizer' && String(expo.organizerRef) === String(req.user._id);
  if (!PUBLIC_STATUSES.includes(expo.status) && !isOwner) throw ApiError.notFound('That expo does not exist');

  const sessions = await Session.find({ expoRef: expo._id }).sort({ startTime: 1 }).lean();

  return ok(
    res,
    {
      items: sessions.map((s) => ({
        ...s,
        id: String(s._id),
        seatsRemaining: s.capacity == null ? null : Math.max(s.capacity - s.registeredCount, 0),
        isFull: s.capacity != null && s.registeredCount >= s.capacity,
      })),
      expo: { id: String(expo._id), title: expo.title, startDate: expo.startDate, endDate: expo.endDate },
    },
    'Schedule loaded'
  );
});

// GET /api/sessions/:id
const getSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id).populate('expoRef', 'title status organizerRef');
  if (!session) throw ApiError.notFound('Session not found');

  const isOwner = req.user?.role === 'organizer' && String(session.expoRef?.organizerRef) === String(req.user._id);
  if (!PUBLIC_STATUSES.includes(session.expoRef?.status) && !isOwner) throw ApiError.notFound('Session not found');

  return ok(res, { session: session.toJSON() }, 'Session loaded');
});

// POST /api/sessions
const createSession = asyncHandler(async (req, res) => {
  const { expoRef, ...details } = req.body;
  const expo = await loadOwnedExpo(expoRef, req.user);
  assertWithinExpo(expo, details.startTime, details.endTime);

  const session = await Session.create({ ...details, expoRef: expo._id });
  return created(res, { session: session.toJSON() }, 'Session added to the schedule');
});

// PATCH /api/sessions/:id
const updateSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) throw ApiError.notFound('Session not found');

  const expo = await loadOwnedExpo(session.expoRef, req.user);

  const startTime = req.body.startTime ?? session.startTime;
  const endTime = req.body.endTime ?? session.endTime;
  if (endTime <= startTime) {
    throw ApiError.badRequest('End time must be after the start time', [
      { field: 'endTime', message: 'Must be after the start time' },
    ]);
  }
  assertWithinExpo(expo, startTime, endTime);

  // shrinking capacity below the seats already taken would silently oversell.
  if ('capacity' in req.body) await assertCapacityFitsExisting(session._id, req.body.capacity);

  Object.assign(session, req.body);
  await session.save();

  return ok(res, { session: session.toJSON() }, 'Session updated');
});

// DELETE /api/sessions/:id
const deleteSession = asyncHandler(async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) throw ApiError.notFound('Session not found');
  await loadOwnedExpo(session.expoRef, req.user);

  // registrations for a deleted session would dangle, so they go too.
  await Registration.deleteMany({ sessionRef: session._id });
  await session.deleteOne();

  return ok(res, { id: String(session._id) }, 'Session removed from the schedule');
});

module.exports = { listByExpo, getSession, createSession, updateSession, deleteSession };
