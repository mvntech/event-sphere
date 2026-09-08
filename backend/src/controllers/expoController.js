const Expo = require('../models/Expo');
const Session = require('../models/Session');
const Registration = require('../models/Registration');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');

const PUBLIC_STATUSES = ['published', 'ongoing', 'completed'];

/** only the owning organizer may change an expo. */
function assertOwner(expo, user) {
  if (String(expo.organizerRef?._id ?? expo.organizerRef) !== String(user._id)) {
    throw ApiError.forbidden('This expo belongs to another organizer');
  }
}

/** draft and cancelled expos stay invisible to anyone but their organizer. */
function assertVisible(expo, user) {
  if (PUBLIC_STATUSES.includes(expo.status)) return;
  if (user && user.role === 'organizer' && String(expo.organizerRef?._id ?? expo.organizerRef) === String(user._id)) return;
  throw ApiError.notFound('Expo not found');
}

// GET /api/expos
const listExpos = asyncHandler(async (req, res) => {
  const { status, search, mine, page, limit } = req.validatedQuery;
  const user = req.user;

  const filter = {};

  if (mine === 'true') {
    if (!user || user.role !== 'organizer') throw ApiError.forbidden('Only organizers have their own expos');
    filter.organizerRef = user._id;
    if (status) filter.status = status;
  } else {
    // everyone else sees the public catalogue only.
    filter.status = status && PUBLIC_STATUSES.includes(status) ? status : { $in: PUBLIC_STATUSES };
  }

  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Expo.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { startDate: 1 })
      .skip(skip)
      .limit(limit)
      .populate('organizerRef', 'name email')
      .lean(),
    Expo.countDocuments(filter),
  ]);

  return ok(
    res,
    {
      items: items.map((e) => ({ ...e, id: String(e._id) })),
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    },
    'Expos loaded'
  );
});

// GET /api/expos/:id
const getExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.findById(req.params.id).populate('organizerRef', 'name email');
  if (!expo) throw ApiError.notFound('Expo not found');
  assertVisible(expo, req.user);

  const [sessionCount, exhibitorCount] = await Promise.all([
    Session.countDocuments({ expoRef: expo._id }),
    ExhibitorProfile.countDocuments({ expoRef: expo._id, approvalStatus: 'approved' }),
  ]);

  return ok(res, { expo: expo.toJSON(), stats: { sessionCount, exhibitorCount } }, 'Expo loaded');
});

// POST /api/expos
const createExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.create({ ...req.body, organizerRef: req.user._id });
  return created(res, { expo: expo.toJSON() }, 'Expo created');
});

// PATCH /api/expos/:id
const updateExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.findById(req.params.id);
  if (!expo) throw ApiError.notFound('Expo not found');
  assertOwner(expo, req.user);

  Object.assign(expo, req.body);
  await expo.save();

  return ok(res, { expo: expo.toJSON() }, 'Expo updated');
});

// DELETE /api/expos/:id
const deleteExpo = asyncHandler(async (req, res) => {
  const expo = await Expo.findById(req.params.id);
  if (!expo) throw ApiError.notFound('Expo not found');
  assertOwner(expo, req.user);

  // deleting an expo people have committed to would orphan their records, so
  // it is refused — cancelling the expo is the reversible alternative.
  const [registrations, approvedExhibitors] = await Promise.all([
    Registration.countDocuments({ expoRef: expo._id, status: { $ne: 'cancelled' } }),
    ExhibitorProfile.countDocuments({ expoRef: expo._id, approvalStatus: 'approved' }),
  ]);

  if (registrations > 0 || approvedExhibitors > 0) {
    throw ApiError.conflict(
      `This expo has ${registrations} registration(s) and ${approvedExhibitors} approved exhibitor(s). Set its status to "cancelled" instead of deleting it.`
    );
  }

  // nothing is committed yet, so the dependent drafts go with it.
  await Promise.all([
    Session.deleteMany({ expoRef: expo._id }),
    ExhibitorProfile.deleteMany({ expoRef: expo._id }),
    Registration.deleteMany({ expoRef: expo._id }),
  ]);
  await expo.deleteOne();

  return ok(res, { id: String(expo._id) }, 'Expo deleted');
});

module.exports = { listExpos, getExpo, createExpo, updateExpo, deleteExpo, PUBLIC_STATUSES };
