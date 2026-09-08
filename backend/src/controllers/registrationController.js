const Registration = require('../models/Registration');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const registrationService = require('../services/registrationService');
const analytics = require('../services/analyticsService');

const populate = [
  { path: 'expoRef', select: 'title location startDate endDate status' },
  { path: 'sessionRef', select: 'title speaker topic location startTime endTime capacity registeredCount' },
];

// POST /api/registrations
const createRegistration = asyncHandler(async (req, res) => {
  const { expoRef, sessionRef, bookmarked } = req.body;

  const { registration, session } = await registrationService.register({
    attendeeId: req.user._id,
    expoId: expoRef,
    sessionId: sessionRef,
    bookmarked,
  });

  await registration.populate(populate);

  // engagement signal for the analytics dashboard
  if (sessionRef && bookmarked) {
    analytics.record({ expoRef, type: 'sessionBookmark', targetRef: sessionRef, userRef: req.user._id });
  }

  return created(
    res,
    {
      registration: registration.toJSON(),
      seatsRemaining: session ? session.seatsRemaining : null,
    },
    sessionRef ? 'Seat reserved' : 'Registered for the expo'
  );
});

// GET /api/registrations/me
const listMine = asyncHandler(async (req, res) => {
  const { expoRef, bookmarked } = req.query;

  const filter = { attendeeRef: req.user._id, status: { $ne: 'cancelled' } };
  if (expoRef) filter.expoRef = expoRef;
  if (bookmarked === 'true') filter.bookmarked = true;

  const items = await Registration.find(filter).sort({ registeredAt: -1 }).populate(populate).lean();

  return ok(res, { items: items.map((r) => ({ ...r, id: String(r._id) })) }, 'Your registrations');
});

// PATCH /api/registrations/:id — bookmark toggle
const updateRegistration = asyncHandler(async (req, res) => {
  const registration = await Registration.findOne({ _id: req.params.id, attendeeRef: req.user._id });
  if (!registration) throw ApiError.notFound('Registration not found');

  const wasBookmarked = registration.bookmarked;
  if (req.body.bookmarked !== undefined) registration.bookmarked = req.body.bookmarked;
  await registration.save();

  // only a fresh bookmark counts; toggling it off is not new interest.
  if (!wasBookmarked && registration.bookmarked && registration.sessionRef) {
    analytics.record({
      expoRef: registration.expoRef,
      type: 'sessionBookmark',
      targetRef: registration.sessionRef,
      userRef: req.user._id,
    });
  }
  await registration.populate(populate);

  return ok(res, { registration: registration.toJSON() }, 'Registration updated');
});

// DELETE /api/registrations/:id — cancels and returns the seat to the pool
const cancelRegistration = asyncHandler(async (req, res) => {
  const registration = await registrationService.cancel({
    attendeeId: req.user._id,
    registrationId: req.params.id,
  });

  return ok(res, { registration: registration.toJSON() }, 'Registration cancelled');
});

module.exports = { createRegistration, listMine, updateRegistration, cancelRegistration };
