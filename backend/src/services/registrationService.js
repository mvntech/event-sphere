const mongoose = require('mongoose');
const Session = require('../models/Session');
const Registration = require('../models/Registration');
const Expo = require('../models/Expo');
const ApiError = require('../utils/ApiError');

/**
 * claims one seat on a session, atomically.
 *
 * the check and the increment are a single conditional update, so two
 * simultaneous requests for the last seat cannot both succeed — a plain
 * "count, compare, then insert" would let both through under load.
 * `capacity: null` means unlimited, so the filter only guards finite ones.
 *
 * @returns {Promise<import('mongoose').Document|null>} the updated session, or
 *          null when the session is already full.
 */
function claimSeat(sessionId) {
  return Session.findOneAndUpdate(
    {
      _id: sessionId,
      $or: [
        { capacity: null },
        { $expr: { $lt: ['$registeredCount', '$capacity'] } },
      ],
    },
    { $inc: { registeredCount: 1 } },
    { new: true }
  );
}

/** gives a seat back. clamped at zero so a double-release can't go negative. */
function releaseSeat(sessionId) {
  return Session.findOneAndUpdate(
    { _id: sessionId, registeredCount: { $gt: 0 } },
    { $inc: { registeredCount: -1 } },
    { new: true }
  );
}

/**
 * registers an attendee for a session (or for the expo itself when
 * `sessionId` is null).
 */
async function register({ attendeeId, expoId, sessionId = null, bookmarked = false }) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo no longer exists');
  if (!expo.isPublic) throw ApiError.badRequest('That expo is not open for registration yet');

  let session = null;
  if (sessionId) {
    session = await Session.findById(sessionId);
    if (!session) throw ApiError.notFound('That session no longer exists');
    if (String(session.expoRef) !== String(expoId)) {
      throw ApiError.badRequest('That session belongs to a different expo');
    }
  }

  // re-activating a cancelled registration re-claims a seat; an active one is a no-op.
  const existing = await Registration.findOne({
    attendeeRef: attendeeId,
    expoRef: expoId,
    sessionRef: sessionId,
  });

  if (existing && existing.status !== 'cancelled') {
    throw ApiError.conflict(
      sessionId ? 'You are already registered for this session' : 'You are already registered for this expo'
    );
  }

  if (session) {
    const claimed = await claimSeat(session._id);
    if (!claimed) {
      throw ApiError.conflict(
        `"${session.title}" is full — all ${session.capacity} seats are taken.`,
        [{ field: 'sessionRef', message: 'Session is at capacity' }]
      );
    }
    session = claimed;
  }

  try {
    if (existing) {
      existing.status = 'registered';
      existing.cancelledAt = null;
      existing.registeredAt = new Date();
      if (bookmarked) existing.bookmarked = true;
      await existing.save();
      return { registration: existing, session };
    }

    const registration = await Registration.create({
      attendeeRef: attendeeId,
      expoRef: expoId,
      sessionRef: sessionId,
      bookmarked,
      status: 'registered',
    });
    return { registration, session };
  } catch (err) {
    // The seat is claimed but the row failed — hand it back rather than leaking it.
    if (session) await releaseSeat(session._id);

    if (err.code === 11000) {
      throw ApiError.conflict('You are already registered for this');
    }
    throw err;
  }
}

/** cancels a registration and returns its seat to the pool. */
async function cancel({ attendeeId, registrationId }) {
  const registration = await Registration.findOne({ _id: registrationId, attendeeRef: attendeeId });
  if (!registration) throw ApiError.notFound('Registration not found');

  if (registration.status === 'cancelled') return registration;

  registration.status = 'cancelled';
  registration.cancelledAt = new Date();
  await registration.save();

  if (registration.sessionRef) await releaseSeat(registration.sessionRef);

  return registration;
}

/**
 * recomputes `registeredCount` from the registration rows. the counter is the
 * source of truth at write time; this repairs it after a seed or a manual edit.
 */
async function recountSession(sessionId) {
  const registeredCount = await Registration.countDocuments({
    sessionRef: sessionId,
    status: 'registered',
  });
  return Session.findByIdAndUpdate(sessionId, { registeredCount }, { new: true });
}

/** guards a capacity reduction: an organizer can't shrink below seats already taken. */
async function assertCapacityFitsExisting(sessionId, nextCapacity) {
  if (nextCapacity == null) return;

  const taken = await Registration.countDocuments({
    sessionRef: sessionId,
    status: 'registered',
  });

  if (nextCapacity < taken) {
    throw ApiError.conflict(
      `Capacity cannot drop below ${taken} — that many people are already registered.`,
      [{ field: 'capacity', message: `At least ${taken} required` }]
    );
  }
}

module.exports = {
  register,
  cancel,
  claimSeat,
  releaseSeat,
  recountSession,
  assertCapacityFitsExisting,
  isValidId: (id) => mongoose.isValidObjectId(id),
};
