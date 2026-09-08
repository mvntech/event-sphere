const Expo = require('../models/Expo');
const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

// GET /api/stats/public — headline counts for the marketing pages.
const TTL_MS = 5 * 60 * 1000;

let cache = null;

/** exposed for tests, which must not inherit a warm cache from another case. */
function resetCache() {
  cache = null;
}

const publicStats = asyncHandler(async (_req, res) => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return ok(res, cache.data, 'Public counts (cached)');
  }

  const [expos, exhibitors, attendees] = await Promise.all([
    Expo.countDocuments({ status: { $ne: 'draft' } }),
    ExhibitorProfile.countDocuments({ approvalStatus: 'approved' }),
    User.countDocuments({ role: 'attendee', deletionRequestedAt: null }),
  ]);

  const data = { expos, exhibitors, attendees };
  cache = { at: Date.now(), data };

  return ok(res, data, 'Public counts');
});

module.exports = { publicStats, resetCache };
