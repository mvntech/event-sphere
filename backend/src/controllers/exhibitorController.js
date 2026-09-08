const ExhibitorProfile = require('../models/ExhibitorProfile');
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const uploadService = require('../services/uploadService');
const { MAX_DOCUMENTS } = require('../middleware/upload');
const { sendExhibitorDecisionEmail } = require('../services/emailService');
const { notify } = require('../services/notificationService');
const analytics = require('../services/analyticsService');
const logger = require('../utils/logger');

const populate = [
  { path: 'userRef', select: 'name email avatarUrl' },
  { path: 'expoRef', select: 'title startDate endDate location status organizerRef' },
];

/** loads a profile the signed-in user is allowed to write to. */
async function loadForWrite(profileId, user, { organizerAllowed = true } = {}) {
  const profile = await ExhibitorProfile.findById(profileId).select('+logoPublicId').populate(populate);
  if (!profile) throw ApiError.notFound('Exhibitor profile not found');

  const isOwner = String(profile.userRef?._id ?? profile.userRef) === String(user._id);
  const isOrganizer =
    organizerAllowed &&
    user.role === 'organizer' &&
    String(profile.expoRef?.organizerRef ?? '') === String(user._id);

  if (!isOwner && !isOrganizer) throw ApiError.forbidden('This exhibitor profile belongs to someone else');

  return { profile, isOwner, isOrganizer };
}

/** multer's `.fields()` gives an object, `.array()` gives an array — handle both. */
const filesOf = (req, field) => {
  if (!req.files) return [];
  return Array.isArray(req.files) ? req.files.filter((f) => f.fieldname === field) : req.files[field] || [];
};

// POST /api/exhibitors — exhibitor applies to an expo (multipart)
const apply = asyncHandler(async (req, res) => {
  const { expoRef, ...details } = req.body;

  const expo = await Expo.findById(expoRef);
  if (!expo) throw ApiError.notFound('That expo does not exist');
  if (!expo.isPublic) throw ApiError.badRequest('That expo is not accepting applications yet');

  const duplicate = await ExhibitorProfile.exists({ userRef: req.user._id, expoRef });
  if (duplicate) {
    throw ApiError.conflict('You have already applied to this expo — edit your existing application instead');
  }

  const [logoFile] = filesOf(req, 'logo');
  const documentFiles = filesOf(req, 'documents');

  const [logo, documents] = await Promise.all([
    logoFile ? uploadService.uploadLogo(logoFile) : null,
    Promise.all(documentFiles.map((f) => uploadService.uploadDocument(f))),
  ]);

  const profile = await ExhibitorProfile.create({
    ...details,
    userRef: req.user._id,
    expoRef,
    logoUrl: logo?.url ?? null,
    logoPublicId: logo?.publicId ?? null,
    documents,
    approvalStatus: 'pending',
  });

  await profile.populate(populate);
  return created(res, { profile: profile.toJSON() }, 'Application submitted — an organizer will review it shortly');
});

// GET /api/exhibitors — organizer review queue, or the public directory
const listExhibitors = asyncHandler(async (req, res) => {
  const { expoRef, approvalStatus, category, search, page, limit } = req.validatedQuery;
  const filter = {};

  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  if (req.user?.role === 'organizer') {
    // organizers see every application, but only on their own expos.
    const ownExpoIds = await Expo.find({ organizerRef: req.user._id }).distinct('_id');
    const scoped = expoRef ? ownExpoIds.filter((id) => String(id) === String(expoRef)) : ownExpoIds;
    filter.expoRef = { $in: scoped };
    if (approvalStatus) filter.approvalStatus = approvalStatus;
  } else {
    // everyone else only ever sees approved exhibitors.
    if (expoRef) filter.expoRef = expoRef;
    filter.approvalStatus = 'approved';
  }

  // status tallies power the queue's tabs, so they ignore the status filter itself.
  const countFilter = { ...filter };
  delete countFilter.approvalStatus;

  const skip = (page - 1) * limit;

  const [items, total, statusCounts] = await Promise.all([
    ExhibitorProfile.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(populate)
      .lean(),
    ExhibitorProfile.countDocuments(filter),
    ExhibitorProfile.aggregate([
      { $match: countFilter },
      { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
    ]),
  ]);

  // what attendees actually searched for, for the dashboard's search panel.
  // only public directory searches count — an organizer filtering their own
  // review queue is not attendee interest.
  if (search && expoRef && req.user?.role !== 'organizer') {
    analytics.record({ expoRef, type: 'search', userRef: req.user?._id ?? null, query: search });
  }

  const counts = { pending: 0, approved: 0, rejected: 0 };
  statusCounts.forEach((row) => {
    counts[row._id] = row.count;
  });

  return ok(
    res,
    {
      items: items.map((p) => ({ ...p, id: String(p._id) })),
      counts,
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    },
    'Exhibitors loaded'
  );
});

// GET /api/exhibitors/me — the signed-in exhibitor's own applications
const listMine = asyncHandler(async (req, res) => {
  const items = await ExhibitorProfile.find({ userRef: req.user._id })
    .sort({ createdAt: -1 })
    .populate(populate)
    .lean();

  return ok(res, { items: items.map((p) => ({ ...p, id: String(p._id) })) }, 'Your applications');
});

// GET /api/exhibitors/:id
const getExhibitor = asyncHandler(async (req, res) => {
  const profile = await ExhibitorProfile.findById(req.params.id).populate(populate);
  if (!profile) throw ApiError.notFound('Exhibitor profile not found');

  const isOwner = req.user && String(profile.userRef?._id ?? profile.userRef) === String(req.user._id);
  const isOrganizer =
    req.user?.role === 'organizer' && String(profile.expoRef?.organizerRef ?? '') === String(req.user._id);

  // a pending or rejected application is private to its owner and the organizer.
  if (profile.approvalStatus !== 'approved' && !isOwner && !isOrganizer) {
    throw ApiError.notFound('Exhibitor profile not found');
  }

  // someone looked at this exhibitor — the signal behind "profile views".
  if (profile.approvalStatus === 'approved' && !isOwner) {
    analytics.record({
      expoRef: profile.expoRef?._id ?? profile.expoRef,
      type: 'profileView',
      targetRef: profile._id,
      userRef: req.user?._id ?? null,
    });
  }

  // the booth they hold, so the profile can link straight to it on the plan.
  const booth = await Booth.findOne({ exhibitorRef: profile._id })
    .select('label x y width height status expoRef')
    .lean();

  return ok(
    res,
    {
      profile: profile.toJSON(),
      booth: booth ? { ...booth, id: String(booth._id) } : null,
    },
    'Exhibitor loaded'
  );
});

// PATCH /api/exhibitors/:id — exhibitor edits their own profile
const updateExhibitor = asyncHandler(async (req, res) => {
  const { profile } = await loadForWrite(req.params.id, req.user, { organizerAllowed: false });

  const { contact, ...rest } = req.body;
  Object.assign(profile, rest);
  if (contact) {
    const current = typeof profile.contact?.toObject === 'function' ? profile.contact.toObject() : profile.contact;
    profile.contact = { ...current, ...contact };
  }

  await profile.save();
  await profile.populate(populate);

  return ok(res, { profile: profile.toJSON() }, 'Profile updated');
});

// PATCH /api/exhibitors/:id/status — organizer approves or rejects
const reviewExhibitor = asyncHandler(async (req, res) => {
  const profile = await ExhibitorProfile.findById(req.params.id).populate(populate);
  if (!profile) throw ApiError.notFound('Exhibitor profile not found');

  if (String(profile.expoRef?.organizerRef ?? '') !== String(req.user._id)) {
    throw ApiError.forbidden('You do not run the expo this application is for');
  }

  const { approvalStatus, reviewNote } = req.body;
  profile.approvalStatus = approvalStatus;
  profile.reviewNote = reviewNote;
  profile.reviewedBy = req.user._id;
  profile.reviewedAt = new Date();
  await profile.save();

  // the decision email is a side effect — a mail outage must not fail the review (§10).
  sendExhibitorDecisionEmail({
    to: profile.userRef.email,
    name: profile.userRef.name,
    companyName: profile.companyName,
    expoTitle: profile.expoRef?.title,
    approved: approvalStatus === 'approved',
    note: reviewNote,
  }).catch((err) => logger.warn('Exhibitor decision email failed', { message: err.message }));

  // the in-app half of the same trigger — reaches them while they are online (§10).
  const approved = approvalStatus === 'approved';
  await notify({
    userRef: profile.userRef._id,
    type: approved ? 'exhibitor-approved' : 'exhibitor-rejected',
    message: approved
      ? `Your application for ${profile.expoRef?.title ?? 'the expo'} was approved`
      : `Your application for ${profile.expoRef?.title ?? 'the expo'} was not approved`,
    link: approved ? '/exhibitor/booth' : '/exhibitor/profile',
    expoRef: profile.expoRef?._id ?? null,
  });

  return ok(res, { profile: profile.toJSON() }, `Application ${approvalStatus}`);
});

// POST /api/exhibitors/:id/logo
const replaceLogo = asyncHandler(async (req, res) => {
  const { profile } = await loadForWrite(req.params.id, req.user, { organizerAllowed: false });
  if (!req.file) throw ApiError.badRequest('Choose a logo image to upload');

  const previousPublicId = profile.logoPublicId;
  const logo = await uploadService.uploadLogo(req.file);

  profile.logoUrl = logo.url;
  profile.logoPublicId = logo.publicId;
  await profile.save();

  // only bin the old file once the new one is safely recorded.
  if (previousPublicId) await uploadService.destroyAsset(previousPublicId, 'image');

  return ok(res, { logoUrl: profile.logoUrl }, 'Logo updated');
});

// POST /api/exhibitors/:id/documents
const addDocuments = asyncHandler(async (req, res) => {
  const { profile } = await loadForWrite(req.params.id, req.user, { organizerAllowed: false });

  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest('Choose at least one document to upload');

  const total = profile.documents.length + files.length;
  if (total > MAX_DOCUMENTS) {
    throw ApiError.badRequest(
      `That would take you to ${total} documents. The limit is ${MAX_DOCUMENTS} — remove one first.`
    );
  }

  const uploaded = await Promise.all(files.map((f) => uploadService.uploadDocument(f)));
  profile.documents.push(...uploaded);
  await profile.save();

  return created(res, { documents: profile.toJSON().documents }, `${uploaded.length} document(s) uploaded`);
});

// DELETE /api/exhibitors/:id/documents/:documentId
const removeDocument = asyncHandler(async (req, res) => {
  const { profile } = await loadForWrite(req.params.id, req.user, { organizerAllowed: false });

  const doc = profile.documents.id(req.params.documentId);
  if (!doc) throw ApiError.notFound('That document is not attached to this profile');

  const { publicId, resourceType } = doc;
  doc.deleteOne();
  await profile.save();
  await uploadService.destroyAsset(publicId, resourceType);

  return ok(res, { documents: profile.toJSON().documents }, 'Document removed');
});

module.exports = {
  apply,
  listExhibitors,
  listMine,
  getExhibitor,
  updateExhibitor,
  reviewExhibitor,
  replaceLogo,
  addDocuments,
  removeDocument,
};
