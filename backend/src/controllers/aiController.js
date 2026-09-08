const Expo = require('../models/Expo');
const Session = require('../models/Session');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');
const aiService = require('../services/aiService');
const { PUBLIC_STATUSES } = require('./expoController');
const analytics = require('../services/analyticsService');

// AI endpoints

/** an expo the caller is allowed to read. */
async function loadVisibleExpo(expoId, user) {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const isOwner = user?.role === 'organizer' && String(expo.organizerRef) === String(user._id);
  if (!PUBLIC_STATUSES.includes(expo.status) && !isOwner) throw ApiError.notFound('That expo does not exist');

  return expo;
}

/** approved exhibitors are the only ones the AI is allowed to see or suggest. */
const approvedExhibitors = (expoId) =>
  ExhibitorProfile.find({ expoRef: expoId, approvalStatus: 'approved' })
    .select('companyName category description products logoUrl')
    .lean();

// POST /api/ai/schedule — attendee interests -> itinerary
const schedule = asyncHandler(async (req, res) => {
  const { expoRef, interests } = req.body;
  const expo = await loadVisibleExpo(expoRef, req.user);

  const sessions = await Session.find({ expoRef: expo._id }).sort({ startTime: 1 }).lean();

  if (sessions.length === 0) {
    return ok(
      res,
      { itinerary: [], summary: 'This expo has no sessions scheduled yet.', source: 'fallback' },
      'Nothing to plan yet'
    );
  }

  const enriched = sessions.map((s) => ({
    ...s,
    id: String(s._id),
    isFull: s.capacity != null && s.registeredCount >= s.capacity,
  }));

  const result = await aiService.generateSchedule(interests, enriched);

  return ok(res, result, result.source === 'ai' ? 'Itinerary ready' : 'Itinerary built without AI');
});

// POST /api/ai/match — attendee interests -> recommended exhibitors
const match = asyncHandler(async (req, res) => {
  const { expoRef, interests } = req.body;
  const expo = await loadVisibleExpo(expoRef, req.user);

  const profiles = await approvedExhibitors(expo._id);

  if (profiles.length === 0) {
    return ok(res, { matches: [], source: 'fallback' }, 'No exhibitors to recommend yet');
  }

  const result = await aiService.matchExhibitors(
    interests,
    profiles.map((p) => ({ ...p, id: String(p._id) }))
  );

  // attach the full profile so the frontend renders cards, not bare ids.
  const byId = new Map(profiles.map((p) => [String(p._id), { ...p, id: String(p._id) }]));
  const matches = result.matches
    .map((m) => ({ ...m, exhibitor: byId.get(m.exhibitorId) }))
    .filter((m) => m.exhibitor);

  return ok(res, { ...result, matches }, result.source === 'ai' ? 'Recommendations ready' : 'Recommendations without AI');
});

// POST /api/ai/search — natural-language exhibitor search
const search = asyncHandler(async (req, res) => {
  const { expoRef, query } = req.body;
  const expo = await loadVisibleExpo(expoRef, req.user);

  const profiles = await approvedExhibitors(expo._id);

  // a natural-language search is still a search, so it feeds the same panel.
  analytics.record({ expoRef: expo._id, type: 'search', userRef: req.user._id, query });

  if (profiles.length === 0) {
    return ok(res, { results: [], interpretation: '', source: 'fallback' }, 'No exhibitors to search yet');
  }

  const result = await aiService.semanticSearch(
    query,
    profiles.map((p) => ({ ...p, id: String(p._id) })),
    // fallback path
    () =>
      ExhibitorProfile.find({
        expoRef: expo._id,
        approvalStatus: 'approved',
        $text: { $search: query },
      })
        .select('companyName category description products logoUrl')
        .limit(10)
        .lean()
  );

  const byId = new Map(profiles.map((p) => [String(p._id), { ...p, id: String(p._id) }]));
  const results = result.results
    .map((r) => ({ ...r, exhibitor: byId.get(r.exhibitorId) }))
    .filter((r) => r.exhibitor);

  return ok(res, { ...result, results }, result.source === 'ai' ? 'Search complete' : 'Keyword results');
});

// POST /api/ai/summarize — analytics -> plain-English insights (organizer only)
const summarize = asyncHandler(async (req, res) => {
  const { expoRef } = req.body;

  const expo = await Expo.findById(expoRef);
  if (!expo) throw ApiError.notFound('That expo does not exist');
  if (String(expo.organizerRef) !== String(req.user._id)) {
    throw ApiError.forbidden('This expo belongs to another organizer');
  }

  // the summary is grounded in the same real AnalyticsEvent-backed
  // dashboard the organizer sees, so the prose and the charts cannot disagree.
  const dashboard = await analytics.buildDashboard(expo._id);

  const analyticsData = {
    expo: { title: expo.title, status: expo.status },
    engagement: {
      totalEvents: dashboard.totals.allEvents,
      boothViews: dashboard.totals.boothView,
      sessionBookmarks: dashboard.totals.sessionBookmark,
      profileViews: dashboard.totals.profileView,
      searches: dashboard.totals.search,
      uniqueVisitors: dashboard.totals.uniqueVisitors,
      // the last week of daily activity, so trends are visible.
      recentDaily: dashboard.engagement.slice(-7),
    },
    sessions: {
      total: dashboard.sessions.total,
      totalRegistrations: dashboard.sessions.totalRegistrations,
      full: dashboard.sessions.full,
      mostPopular: dashboard.sessionPopularity.slice(0, 5),
      emptiest: [...dashboard.sessionPopularity].reverse().slice(0, 3),
    },
    booths: {
      total: dashboard.booths.total,
      taken: dashboard.booths.reserved + dashboard.booths.assigned,
      available: dashboard.booths.available,
      occupancyPercent: dashboard.booths.occupancy,
      busiest: dashboard.boothTraffic.slice(0, 5),
    },
    exhibitors: dashboard.exhibitors,
    mostViewedExhibitors: dashboard.exhibitorViews.slice(0, 5),
    topSearches: dashboard.topSearches,
    registrations: { total: dashboard.totals.registrations },
    feedback: dashboard.feedback,
  };

  const result = await aiService.summarizeAnalytics(analyticsData);

  return ok(
    res,
    { ...result, data: analyticsData },
    result.source === 'ai' ? 'Summary ready' : 'Summary without AI'
  );
});

// POST /api/ai/generate-description — bullet points -> profile copy (exhibitor)
const generateDescription = asyncHandler(async (req, res) => {
  const { bulletPoints, companyName, category } = req.body;

  const result = await aiService.generateExhibitorDescription(bulletPoints, { companyName, category });

  return ok(res, result, result.source === 'ai' ? 'Draft ready' : 'Draft assembled without AI');
});

/**
 * POST /api/ai/triage-feedback — sentiment/category tagging (organizer).
 * given a feedbackRef the tags are persisted, so the inbox keeps them.
 */
const triage = asyncHandler(async (req, res) => {
  const { feedbackRef, text } = req.body;

  let feedback = null;
  let content = text;

  if (feedbackRef) {
    feedback = await Feedback.findById(feedbackRef).populate({ path: 'expoRef', select: 'organizerRef' });
    if (!feedback) throw ApiError.notFound('Feedback not found');

    if (!feedback.expoRef || String(feedback.expoRef.organizerRef) !== String(req.user._id)) {
      throw ApiError.forbidden('That feedback belongs to another organizer');
    }
    content = feedback.content;
  }

  const result = await aiService.triageFeedback(content);

  if (feedback) {
    feedback.aiSentiment = result.sentiment;
    feedback.aiCategory = result.category;
    await feedback.save();
  }

  return ok(res, result, result.source === 'ai' ? 'Feedback triaged' : 'Feedback triaged without AI');
});

/** GET /api/ai/status — whether the AI layer is live, for the UI to show. */
const status = asyncHandler(async (_req, res) =>
  ok(res, { configured: aiService.isConfigured() }, 'AI status')
);

module.exports = { schedule, match, search, summarize, generateDescription, triage, status };
