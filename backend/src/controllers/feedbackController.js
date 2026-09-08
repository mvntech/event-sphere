const Feedback = require('../models/Feedback');
const Expo = require('../models/Expo');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { notify } = require('../services/notificationService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

const populate = [
  { path: 'userRef', select: 'name email role' },
  { path: 'expoRef', select: 'title' },
];

// POST /api/feedback — open to every role
const submitContact = asyncHandler(async (req, res) => {
  const { name, email, content, category } = req.body;

  const feedback = await Feedback.create({
    userRef: null,
    source: 'contact',
    contact: { name, email },
    content,
    category,
  });

  // same fire-and-forget triage as in-app feedback
  aiService
    .triageFeedback(content)
    .then((triage) =>
      Feedback.updateOne(
        { _id: feedback._id },
        { $set: { aiSentiment: triage.sentiment, aiCategory: triage.category } }
      )
    )
    .catch((err) => logger.warn('Contact triage failed', { message: err.message }));

  // no id is returned: an unauthenticated sender has nothing to do with it,
  // and handing out ids from a public endpoint is free enumeration.
  return created(res, null, 'Thanks — your message reached the EventSphere team.');
});

const submitFeedback = asyncHandler(async (req, res) => {
  const { expoRef, content, category, rating } = req.body;

  let expo = null;
  if (expoRef) {
    expo = await Expo.findById(expoRef).select('title organizerRef');
    if (!expo) throw ApiError.notFound('That expo does not exist');
  }

  const feedback = await Feedback.create({
    userRef: req.user._id,
    source: 'in-app',
    expoRef: expoRef ?? null,
    content,
    category,
    rating: rating ?? null,
  });

  // the organizer sees it land in their inbox without refreshing.
  if (expo) {
    await notify({
      userRef: expo.organizerRef,
      type: 'feedback',
      message: `New feedback on ${expo.title}`,
      link: '/organizer/feedback',
      expoRef: expo._id,
    });
  }

  // AI tagging is a side effect: it must never delay or fail the submission,
  // so it runs after the response is on its way.
  aiService
    .triageFeedback(content)
    .then((triage) =>
      Feedback.updateOne(
        { _id: feedback._id },
        { $set: { aiSentiment: triage.sentiment, aiCategory: triage.category } }
      )
    )
    .catch((err) => logger.warn('Feedback triage failed', { message: err.message }));

  await feedback.populate(populate);
  return created(res, { feedback: feedback.toJSON() }, 'Thanks — your feedback has been sent');
});

// GET /api/feedback — organizer inbox.
const listFeedback = asyncHandler(async (req, res) => {
  const { expoRef, status } = req.query;

  const myExpos = await Expo.find({ organizerRef: req.user._id }).select('_id').lean();
  const myExpoIds = myExpos.map((e) => e._id);

  const filter = { expoRef: { $in: myExpoIds } };

  if (expoRef) {
    const owns = myExpoIds.some((id) => String(id) === String(expoRef));
    if (!owns) throw ApiError.forbidden('That expo belongs to another organizer');
    filter.expoRef = expoRef;
  }
  if (status) filter.status = status;

  const [items, counts] = await Promise.all([
    Feedback.find(filter).sort({ createdAt: -1 }).limit(200).populate(populate).lean(),
    Feedback.aggregate([
      { $match: { expoRef: { $in: myExpoIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const tally = { new: 0, reviewed: 0, resolved: 0 };
  counts.forEach((row) => {
    tally[row._id] = row.count;
  });

  return ok(
    res,
    { items: items.map((f) => ({ ...f, id: String(f._id) })), counts: tally },
    'Feedback inbox'
  );
});

// GET /api/feedback/me — what the signed-in user has submitted
const listMine = asyncHandler(async (req, res) => {
  const items = await Feedback.find({ userRef: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'expoRef', select: 'title' })
    .lean();

  return ok(res, { items: items.map((f) => ({ ...f, id: String(f._id) })) }, 'Your feedback');
});

// PATCH /api/feedback/:id — organizer triages an item
const updateFeedback = asyncHandler(async (req, res) => {
  const feedback = await Feedback.findById(req.params.id).populate({ path: 'expoRef', select: 'organizerRef title' });
  if (!feedback) throw ApiError.notFound('Feedback not found');

  if (!feedback.expoRef || String(feedback.expoRef.organizerRef) !== String(req.user._id)) {
    throw ApiError.forbidden('That feedback belongs to another organizer');
  }

  if (req.body.status) feedback.status = req.body.status;
  if (req.body.organizerNote !== undefined) feedback.organizerNote = req.body.organizerNote;
  await feedback.save();

  await feedback.populate(populate);
  return ok(res, { feedback: feedback.toJSON() }, 'Feedback updated');
});

module.exports = { submitFeedback, listFeedback, listMine, updateFeedback,
  submitContact,
};
