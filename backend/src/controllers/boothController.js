const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { assertPlaceable, assertLayoutValid } = require('../services/boothService');
const { emitToExpo } = require('../services/socketService');
const { sendBoothConfirmationEmail } = require('../services/emailService');
const { notify } = require('../services/notificationService');
const { PUBLIC_STATUSES } = require('./expoController');
const logger = require('../utils/logger');

const exhibitorPopulate = {
  path: 'exhibitorRef',
  select: 'companyName category logoUrl userRef approvalStatus',
};

/** loads an expo the caller organizes, for any layout-editing action. */
async function loadOwnedExpo(expoId, user) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');
  if (String(expo.organizerRef) !== String(user._id)) {
    throw ApiError.forbidden('This expo belongs to another organizer');
  }
  return expo;
}

/** loads an expo anyone may read — public, or the organizer's own draft. */
async function loadVisibleExpo(expoId, user) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const isOwner = user?.role === 'organizer' && String(expo.organizerRef) === String(user._id);
  if (!PUBLIC_STATUSES.includes(expo.status) && !isOwner) throw ApiError.notFound('That expo does not exist');

  return expo;
}

/** the signed-in exhibitor's approved application for this expo. */
async function loadApprovedProfile(expoId, user) {
  const profile = await ExhibitorProfile.findOne({ userRef: user._id, expoRef: expoId });

  if (!profile) {
    throw ApiError.forbidden('Apply to this expo before reserving a booth');
  }
  if (profile.approvalStatus !== 'approved') {
    throw ApiError.forbidden(
      profile.approvalStatus === 'pending'
        ? 'Your application is still being reviewed — booth reservation opens once it is approved'
        : 'Your application for this expo was not approved'
    );
  }

  return profile;
}

/** broadcasts a booth change to everyone viewing this expo's floor plan. */
function broadcastBooth(expoId, booth, action) {
  emitToExpo(expoId, 'booth:updated', {
    boothId: String(booth._id ?? booth.id),
    expoId: String(expoId),
    status: booth.status,
    exhibitorRef: booth.exhibitorRef ? String(booth.exhibitorRef._id ?? booth.exhibitorRef) : null,
    booth: typeof booth.toJSON === 'function' ? booth.toJSON() : booth,
    action,
    at: new Date().toISOString(),
  });
}

// GET /api/booths/expo/:expoId
const listByExpo = asyncHandler(async (req, res) => {
  const expo = await loadVisibleExpo(req.params.expoId, req.user);

  const booths = await Booth.find({ expoRef: expo._id }).sort({ label: 1 }).populate(exhibitorPopulate).lean();

  // an exhibitor needs to know which booth is theirs to render it differently.
  let myProfileId = null;
  if (req.user?.role === 'exhibitor') {
    const profile = await ExhibitorProfile.findOne({ userRef: req.user._id, expoRef: expo._id }).select('approvalStatus');
    if (profile) myProfileId = { id: String(profile._id), approvalStatus: profile.approvalStatus };
  }

  return ok(
    res,
    {
      items: booths.map((b) => ({ ...b, id: String(b._id) })),
      expo: {
        id: String(expo._id),
        title: expo.title,
        status: expo.status,
        floorPlanConfig: expo.floorPlanConfig,
      },
      myProfile: myProfileId,
    },
    'Floor plan loaded'
  );
});

// POST /api/booths — place a single booth
const createBooth = asyncHandler(async (req, res) => {
  const { expoRef, ...geometry } = req.body;
  const expo = await loadOwnedExpo(expoRef, req.user);

  await assertPlaceable(geometry, expo);

  const booth = await Booth.create({ ...geometry, expoRef: expo._id });
  broadcastBooth(expo._id, booth, 'created');

  return created(res, { booth: booth.toJSON() }, 'Booth added');
});

// PATCH /api/booths/:id — move, resize or relabel
const updateBooth = asyncHandler(async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) throw ApiError.notFound('Booth not found');

  const expo = await loadOwnedExpo(booth.expoRef, req.user);

  const candidate = {
    x: req.body.x ?? booth.x,
    y: req.body.y ?? booth.y,
    width: req.body.width ?? booth.width,
    height: req.body.height ?? booth.height,
    label: req.body.label ?? booth.label,
  };

  await assertPlaceable(candidate, expo, booth._id);

  Object.assign(booth, req.body);
  await booth.save();
  await booth.populate(exhibitorPopulate);

  broadcastBooth(expo._id, booth, 'updated');
  return ok(res, { booth: booth.toJSON() }, 'Booth updated');
});

// DELETE /api/booths/:id
const deleteBooth = asyncHandler(async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) throw ApiError.notFound('Booth not found');

  const expo = await loadOwnedExpo(booth.expoRef, req.user);

  if (booth.status !== 'available') {
    throw ApiError.conflict(
      `Booth "${booth.label}" is ${booth.status}. Release it before deleting it.`
    );
  }

  await booth.deleteOne();
  emitToExpo(expo._id, 'booth:updated', {
    boothId: String(booth._id),
    expoId: String(expo._id),
    action: 'deleted',
    at: new Date().toISOString(),
  });

  return ok(res, { id: String(booth._id) }, 'Booth removed');
});

// PUT /api/booths/expo/:expoId/layout
const saveLayout = asyncHandler(async (req, res) => {
  const expo = await loadOwnedExpo(req.params.expoId, req.user);
  const incoming = req.body.booths;

  assertLayoutValid(incoming, expo.floorPlanConfig);

  const existing = await Booth.find({ expoRef: expo._id });
  const existingById = new Map(existing.map((b) => [String(b._id), b]));

  const claimedIds = new Set(incoming.filter((b) => b.id && existingById.has(b.id)).map((b) => b.id));

  const existingByLabel = new Map(
    existing
      .filter((b) => !claimedIds.has(String(b._id)))
      .map((b) => [b.label.trim().toLowerCase(), b])
  );

  const resolved = incoming.map((booth) => {
    if (booth.id && existingById.has(booth.id)) return booth;

    const match = existingByLabel.get(booth.label.trim().toLowerCase());
    if (!match) return booth;

    // claim it, so two id-less booths cannot resolve onto the same document.
    existingByLabel.delete(booth.label.trim().toLowerCase());
    return { ...booth, id: String(match._id) };
  });

  const updates = resolved.filter((booth) => booth.id && existingById.has(booth.id));
  const inserts = resolved.filter((booth) => !booth.id || !existingById.has(booth.id));

  const keptIds = new Set(resolved.filter((b) => b.id).map((b) => b.id));
  const removed = existing.filter((b) => !keptIds.has(String(b._id)));

  // a booth someone has taken cannot be deleted by dragging it off the canvas.
  const occupied = removed.find((b) => b.status !== 'available');
  if (occupied) {
    throw ApiError.conflict(
      `Booth "${occupied.label}" is ${occupied.status} and cannot be removed. Release it first.`
    );
  }

  // only booths whose label actually changes need parking.
  const renamed = updates.filter((booth) => existingById.get(booth.id).label !== booth.label);

  // derived from the booth's own id, so two temporaries can never collide and
  // the value stays inside the 20-character label limit.
  const parkedLabel = (id) => `~${String(id).slice(-12)}`;

  const operations = [
    // 1. free up any labels held by booths leaving the plan.
    ...removed.map((booth) => ({ deleteOne: { filter: { _id: booth._id } } })),

    // 2. park every renamed booth on a placeholder label.
    ...renamed.map((booth) => ({
      updateOne: { filter: { _id: booth.id, expoRef: expo._id }, update: { $set: { label: parkedLabel(booth.id) } } },
    })),

    // 3. apply the real geometry and labels.
    ...updates.map((booth) => {
      const { id, ...fields } = booth;
      return { updateOne: { filter: { _id: id, expoRef: expo._id }, update: { $set: fields } } };
    }),

    // 4. add the new booths last, once every freed label is genuinely free.
    ...inserts.map((booth) => {
      const { id, ...fields } = booth;
      return { insertOne: { document: { ...fields, expoRef: expo._id, status: 'available' } } };
    }),
  ];

  if (operations.length) await Booth.bulkWrite(operations, { ordered: true });

  const booths = await Booth.find({ expoRef: expo._id }).sort({ label: 1 }).populate(exhibitorPopulate).lean();

  emitToExpo(expo._id, 'floorplan:updated', {
    expoId: String(expo._id),
    boothCount: booths.length,
    at: new Date().toISOString(),
  });

  return ok(
    res,
    { items: booths.map((b) => ({ ...b, id: String(b._id) })) },
    `Floor plan saved — ${booths.length} booth${booths.length === 1 ? '' : 's'}`
  );
});

// PATCH /api/booths/:id/reserve — exhibitor claims an available booth.
const reserveBooth = asyncHandler(async (req, res) => {
  const existing = await Booth.findById(req.params.id);
  if (!existing) throw ApiError.notFound('Booth not found');

  const expo = await loadVisibleExpo(existing.expoRef, req.user);
  if (!PUBLIC_STATUSES.includes(expo.status)) {
    throw ApiError.badRequest('This expo is not open for booth reservations yet');
  }

  const profile = await loadApprovedProfile(expo._id, req.user);

  // one booth per exhibitor per expo.
  const alreadyHeld = await Booth.findOne({
    expoRef: expo._id,
    exhibitorRef: profile._id,
    status: { $ne: 'available' },
  });
  if (alreadyHeld && String(alreadyHeld._id) !== String(existing._id)) {
    throw ApiError.conflict(
      `You already hold booth "${alreadyHeld.label}". Release it before reserving another.`
    );
  }

  const booth = await Booth.findOneAndUpdate(
    { _id: existing._id, status: 'available' },
    { $set: { status: 'reserved', exhibitorRef: profile._id } },
    { new: true }
  ).populate(exhibitorPopulate);

  if (!booth) {
    throw ApiError.conflict(`Booth "${existing.label}" was just taken by someone else. Pick another one.`);
  }

  broadcastBooth(expo._id, booth, 'reserved');

  sendBoothConfirmationEmail({
    to: req.user.email,
    name: req.user.name,
    boothLabel: booth.label,
    expoTitle: expo.title,
    size: `${booth.width} × ${booth.height} cells`,
    assignedBy: false,
  }).catch((err) => logger.warn('Booth confirmation email failed', { message: err.message }));

  // let the organizer know without them refreshing the queue.
  await notify({
    userRef: expo.organizerRef,
    type: 'booth-reserved',
    message: `${profile.companyName} reserved booth ${booth.label}`,
    link: '/organizer/floor-plan',
    expoRef: expo._id,
  });

  logger.info('Booth reserved', { booth: booth.label, exhibitor: profile.companyName });

  return ok(res, { booth: booth.toJSON() }, `Booth ${booth.label} reserved`);
});

// PATCH /api/booths/:id/release — exhibitor gives up their booth, or organizer clears one
const releaseBooth = asyncHandler(async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) throw ApiError.notFound('Booth not found');

  const expo = await Expo.findById(booth.expoRef);
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const isOrganizer = req.user.role === 'organizer' && String(expo.organizerRef) === String(req.user._id);

  if (!isOrganizer) {
    const profile = await loadApprovedProfile(expo._id, req.user);
    if (String(booth.exhibitorRef ?? '') !== String(profile._id)) {
      throw ApiError.forbidden('That booth is not yours to release');
    }
  }

  if (booth.status === 'available') {
    return ok(res, { booth: booth.toJSON() }, 'That booth was already available');
  }

  booth.status = 'available';
  booth.exhibitorRef = null;
  await booth.save();

  broadcastBooth(expo._id, booth, 'released');
  return ok(res, { booth: booth.toJSON() }, `Booth ${booth.label} released`);
});

// PATCH /api/booths/:id/assign — organizer assigns or reassigns a booth
const assignBooth = asyncHandler(async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) throw ApiError.notFound('Booth not found');

  const expo = await loadOwnedExpo(booth.expoRef, req.user);

  const profile = await ExhibitorProfile.findById(req.body.exhibitorRef);
  if (!profile) throw ApiError.notFound('That exhibitor does not exist');

  if (String(profile.expoRef) !== String(expo._id)) {
    throw ApiError.badRequest('That exhibitor applied to a different expo');
  }
  if (profile.approvalStatus !== 'approved') {
    throw ApiError.badRequest('Approve the exhibitor before assigning them a booth');
  }

  // reassignment frees whatever they held before, so nobody holds two stands.
  await Booth.updateMany(
    { expoRef: expo._id, exhibitorRef: profile._id, _id: { $ne: booth._id } },
    { $set: { status: 'available', exhibitorRef: null } }
  );

  booth.status = 'assigned';
  booth.exhibitorRef = profile._id;
  await booth.save();
  await booth.populate(exhibitorPopulate);

  broadcastBooth(expo._id, booth, 'assigned');
  
  const recipient = await User.findById(profile.userRef).select('name email').lean();
  if (recipient) {
    sendBoothConfirmationEmail({
      to: recipient.email,
      name: recipient.name,
      boothLabel: booth.label,
      expoTitle: expo.title,
      size: `${booth.width} × ${booth.height} cells`,
      assignedBy: true,
    }).catch((err) => logger.warn('Booth assignment email failed', { message: err.message }));
  }

  await notify({
    userRef: profile.userRef,
    type: 'booth-assigned',
    message: `You have been assigned booth ${booth.label} at ${expo.title}`,
    link: '/exhibitor/booth',
    expoRef: expo._id,
  });

  return ok(res, { booth: booth.toJSON() }, `Booth ${booth.label} assigned to ${profile.companyName}`);
});

module.exports = {
  listByExpo,
  createBooth,
  updateBooth,
  deleteBooth,
  saveLayout,
  reserveBooth,
  releaseBooth,
  assignBooth,
};
