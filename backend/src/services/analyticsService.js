const mongoose = require('mongoose');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const Session = require('../models/Session');
const Booth = require('../models/Booth');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const logger = require('../utils/logger');

/**
 * analytics event logging and aggregation.
 *
 * recording is a side effect of some other action, so it never blocks or fails
 * the request it is attached to — a dropped event is better than a failed
 * booking.
 */

function record({ expoRef, type, targetRef = null, userRef = null, query = '' }) {
  if (!expoRef || !type) return Promise.resolve(null);

  return AnalyticsEvent.create({
    expoRef,
    type,
    targetRef,
    userRef,
    query: String(query).slice(0, 120),
  }).catch((error) => {
    logger.warn('Analytics event dropped', { type, message: error.message });
    return null;
  });
}

const toId = (value) => new mongoose.Types.ObjectId(String(value));

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * mongo's `$dateToString` groups by UTC, so the buckets here must be built on
 * the same basis. using local midnight instead would shift every bucket by the
 * server's offset and drop today's activity into the wrong day.
 */
const utcMidnightToday = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

/** the first instant included in a `days`-long window ending today. */
const windowStart = (days) => new Date(utcMidnightToday() - (days - 1) * DAY_MS);

/** buckets events per day so the engagement chart has a continuous x-axis. */
function fillDailySeries(rows, days) {
  const byDay = new Map(rows.map((row) => [row._id, row]));
  const series = [];
  const today = utcMidnightToday();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = new Date(today - offset * DAY_MS).toISOString().slice(0, 10);
    const row = byDay.get(key);

    series.push({
      date: key,
      boothView: row?.boothView ?? 0,
      sessionBookmark: row?.sessionBookmark ?? 0,
      profileView: row?.profileView ?? 0,
      search: row?.search ?? 0,
      total: row?.total ?? 0,
    });
  }

  return series;
}

/**
 * everything the organizer dashboard renders, in one pass.
 *
 * @param {string} expoId
 * @param {number} days  size of the engagement window
 */
async function buildDashboard(expoId, days = 14) {
  const expoRef = toId(expoId);

  const since = windowStart(days);

  const [
    totals,
    dailyRows,
    boothTraffic,
    sessionInterest,
    exhibitorViews,
    topSearches,
    sessions,
    booths,
    exhibitorCounts,
    registrationCount,
    uniqueVisitors,
    feedback,
  ] = await Promise.all([
    // event totals by type.
    AnalyticsEvent.aggregate([
      { $match: { expoRef } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),

    // engagement per day, split by type.
    AnalyticsEvent.aggregate([
      { $match: { expoRef, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          boothView: { $sum: { $cond: [{ $eq: ['$type', 'boothView'] }, 1, 0] } },
          sessionBookmark: { $sum: { $cond: [{ $eq: ['$type', 'sessionBookmark'] }, 1, 0] } },
          profileView: { $sum: { $cond: [{ $eq: ['$type', 'profileView'] }, 1, 0] } },
          search: { $sum: { $cond: [{ $eq: ['$type', 'search'] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),

    // booth traffic: views per booth, busiest first.
    AnalyticsEvent.aggregate([
      { $match: { expoRef, type: 'boothView', targetRef: { $ne: null } } },
      { $group: { _id: '$targetRef', views: { $sum: 1 }, visitors: { $addToSet: '$userRef' } } },
      { $sort: { views: -1 } },
      { $limit: 12 },
    ]),

    // session popularity from bookmark events.
    AnalyticsEvent.aggregate([
      { $match: { expoRef, type: 'sessionBookmark', targetRef: { $ne: null } } },
      { $group: { _id: '$targetRef', bookmarks: { $sum: 1 } } },
      { $sort: { bookmarks: -1 } },
      { $limit: 12 },
    ]),

    // which exhibitor profiles drew attention.
    AnalyticsEvent.aggregate([
      { $match: { expoRef, type: 'profileView', targetRef: { $ne: null } } },
      { $group: { _id: '$targetRef', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 },
    ]),

    // what people actually typed.
    AnalyticsEvent.aggregate([
      { $match: { expoRef, type: 'search', query: { $ne: '' } } },
      { $group: { _id: { $toLower: '$query' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    Session.find({ expoRef }).select('title capacity registeredCount startTime').sort({ startTime: 1 }).lean(),
    Booth.find({ expoRef }).select('label status').lean(),
    ExhibitorProfile.aggregate([
      { $match: { expoRef } },
      { $group: { _id: '$approvalStatus', count: { $sum: 1 } } },
    ]),
    Registration.countDocuments({ expoRef, status: 'registered' }),
    AnalyticsEvent.distinct('userRef', { expoRef, userRef: { $ne: null } }),
    Feedback.find({ expoRef }).select('rating aiSentiment category content').limit(100).lean(),
  ]);

  // resolve the ranked ids back to names the chart can label.
  // session names come from the full `sessions` list already loaded above, so
  // only booths and exhibitors need resolving here.
  const [boothDocs, exhibitorDocs] = await Promise.all([
    Booth.find({ _id: { $in: boothTraffic.map((b) => b._id) } }).select('label status').lean(),
    ExhibitorProfile.find({ _id: { $in: exhibitorViews.map((e) => e._id) } }).select('companyName category').lean(),
  ]);

  const boothById = new Map(boothDocs.map((b) => [String(b._id), b]));
  const exhibitorById = new Map(exhibitorDocs.map((e) => [String(e._id), e]));

  const eventTotals = { boothView: 0, sessionBookmark: 0, profileView: 0, search: 0 };
  totals.forEach((row) => {
    eventTotals[row._id] = row.count;
  });

  const exhibitors = { approved: 0, pending: 0, rejected: 0 };
  exhibitorCounts.forEach((row) => {
    exhibitors[row._id] = row.count;
  });

  const ratings = feedback.filter((f) => typeof f.rating === 'number');
  const sentiments = { positive: 0, neutral: 0, negative: 0 };
  feedback.forEach((f) => {
    if (f.aiSentiment && sentiments[f.aiSentiment] !== undefined) sentiments[f.aiSentiment] += 1;
  });

  return {
    generatedAt: new Date().toISOString(),
    windowDays: days,

    totals: {
      ...eventTotals,
      allEvents: Object.values(eventTotals).reduce((sum, n) => sum + n, 0),
      uniqueVisitors: uniqueVisitors.length,
      registrations: registrationCount,
    },

    engagement: fillDailySeries(dailyRows, days),

    boothTraffic: boothTraffic
      .map((row) => {
        const booth = boothById.get(String(row._id));
        if (!booth) return null;
        return {
          id: String(row._id),
          label: booth.label,
          status: booth.status,
          views: row.views,
          // a null userRef (signed-out visitor) is not a distinct person.
          visitors: row.visitors.filter(Boolean).length,
        };
      })
      .filter(Boolean),

    sessionPopularity: sessions
      .map((session) => {
        const row = sessionInterest.find((s) => String(s._id) === String(session._id));
        return {
          id: String(session._id),
          title: session.title,
          bookmarks: row?.bookmarks ?? 0,
          registrations: session.registeredCount ?? 0,
          capacity: session.capacity,
          fillRate:
            session.capacity && session.capacity > 0
              ? Math.round(((session.registeredCount ?? 0) / session.capacity) * 100)
              : null,
        };
      })
      .sort((a, b) => b.registrations - a.registrations || b.bookmarks - a.bookmarks),

    exhibitorViews: exhibitorViews
      .map((row) => {
        const profile = exhibitorById.get(String(row._id));
        if (!profile) return null;
        return { id: String(row._id), companyName: profile.companyName, category: profile.category, views: row.views };
      })
      .filter(Boolean),

    topSearches: topSearches.map((row) => ({ query: row._id, count: row.count })),

    booths: {
      total: booths.length,
      available: booths.filter((b) => b.status === 'available').length,
      reserved: booths.filter((b) => b.status === 'reserved').length,
      assigned: booths.filter((b) => b.status === 'assigned').length,
      occupancy: booths.length ? Math.round((booths.filter((b) => b.status !== 'available').length / booths.length) * 100) : 0,
    },

    exhibitors,

    sessions: {
      total: sessions.length,
      totalRegistrations: sessions.reduce((sum, s) => sum + (s.registeredCount ?? 0), 0),
      full: sessions.filter((s) => s.capacity != null && (s.registeredCount ?? 0) >= s.capacity).length,
    },

    feedback: {
      total: feedback.length,
      averageRating: ratings.length
        ? Number((ratings.reduce((sum, f) => sum + f.rating, 0) / ratings.length).toFixed(2))
        : null,
      sentiments,
    },
  };
}

module.exports = { record, buildDashboard, fillDailySeries };
