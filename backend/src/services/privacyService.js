const crypto = require('crypto');
const User = require('../models/User');
const Expo = require('../models/Expo');
const Registration = require('../models/Registration');
const Feedback = require('../models/Feedback');
const Message = require('../models/Message');
const MessageThread = require('../models/MessageThread');
const Notification = require('../models/Notification');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * GDPR-style data control.
 *
 * two operations, both deliberately narrow: hand the person everything held
 * about them, and stop holding anything that identifies them.
 */

/** how long an anonymised row is kept before it can be purged. */
const RETENTION_DAYS = 30;

/**
 * everything stored about one account, as plain JSON.
 *
 * scoped strictly to this person: their own registrations, their own feedback,
 * the messages they wrote. deliberately NOT the other half of their message
 * threads — that is somebody else's writing, and an export is not a route to
 * reading it.
 */
async function exportUserData(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('Account not found');

  const [registrations, feedback, messages, notifications, profiles, expos] = await Promise.all([
    Registration.find({ attendeeRef: userId }).populate('expoRef', 'title').populate('sessionRef', 'title startTime').lean(),
    Feedback.find({ userRef: userId }).populate('expoRef', 'title').lean(),
    Message.find({ senderRef: userId }).lean(),
    Notification.find({ userRef: userId }).lean(),
    ExhibitorProfile.find({ userRef: userId }).populate('expoRef', 'title').lean(),
    Expo.find({ organizerRef: userId }).lean(),
  ]);

  const strip = (doc) => {
    const { __v, ...rest } = doc;
    return rest;
  };

  return {
    exportedAt: new Date().toISOString(),
    note:
      'Everything EventSphere holds that is about you. Messages other people ' +
      'sent you are not included: they are that person\'s writing, not your data.',
    account: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      consentGiven: user.consentGiven,
      notificationPrefs: user.notificationPrefs,
      organizerApprovalStatus: user.organizerApprovalStatus,
      createdAt: user.createdAt,
    },
    registrations: registrations.map(strip),
    feedback: feedback.map(strip),
    messagesYouSent: messages.map(strip),
    notifications: notifications.map(strip),
    exhibitorProfiles: profiles.map(strip),
    exposYouOrganize: expos.map(strip),
  };
}

/**
 * what would block deletion, and why.
 *
 * an organizer who still owns expos cannot be anonymized: exhibitors have
 * applied to those expos, attendees have registered for their sessions, and
 * removing the only person who can administer them strands everybody. They
 * have to hand the expos over or cancel them first — the SRS's own
 * organizer-approval model assumes an expo always has a live owner.
 */
async function deletionBlockers(user) {
  if (user.role !== 'organizer') return [];

  const expos = await Expo.find({
    organizerRef: user._id,
    status: { $ne: 'cancelled' },
  })
    .select('title status')
    .lean();

  if (expos.length === 0) return [];

  return [
    {
      reason: 'owns-active-expos',
      message:
        `You still organize ${expos.length} expo${expos.length === 1 ? '' : 's'}. ` +
        'Transfer them to another organizer or cancel them, then you can delete your account.',
      expos: expos.map((e) => ({ id: String(e._id), title: e.title, status: e.status })),
    },
  ];
}

/**
 * anonymise in place.
 *
 * the email is replaced with a unique non-routable tombstone rather than
 * cleared, because it is a unique index — two deleted accounts would collide
 * on an empty string. The password hash is randomized so the account cannot be
 * signed into even if the old hash were known.
 *
 * Content other people can still see keeps its row but loses its author:
 * an organizer mid-way through actioning feedback should not have it vanish,
 * and a message thread with one side deleted should still read.
 */
async function anonymizeUser(userId) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found');

  const blockers = await deletionBlockers(user);
  if (blockers.length > 0) throw ApiError.conflict(blockers[0].message, blockers);

  const tombstone = `deleted-${crypto.randomBytes(8).toString('hex')}@deleted.eventsphere.invalid`;
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + RETENTION_DAYS * 864e5);

  /*
   * Capture the address BEFORE anonymisation overwrites it.
   *
   * This ordering is the whole reason the confirmation works: two lines below,
   * `user.email` becomes a non-routable tombstone. Sending afterwards would
   * deliver to nowhere and fail silently — the one email where silence is a
   * security problem, because if somebody else deleted the account this is how
   * the owner finds out.
   */
  const notify = { to: user.email, name: user.name };

  user.name = 'Deleted user';
  user.email = tombstone;
  user.avatarUrl = null;
  user.passwordHash = crypto.randomBytes(32).toString('hex');
  user.notificationPrefs = { email: false };
  user.deletionRequestedAt = now;
  user.anonymizedAt = now;
  await user.save({ validateBeforeSave: false });

  // things that only exist for this person go now; nothing else can see them.
  const [notifications, profiles] = await Promise.all([
    Notification.deleteMany({ userRef: userId }),
    ExhibitorProfile.deleteMany({ userRef: userId }),
  ]);

  // things other people can see keep their row but lose the author.
  await Promise.all([
    Feedback.updateMany({ userRef: userId }, { $set: { userRef: null } }),
    MessageThread.updateMany({ participants: userId }, { $pull: { participants: userId } }),
  ]);

  /*
   * Fire and forget, deliberately. A failing mail server must not roll back a
   * deletion the person asked for and which has already happened — the data is
   * gone either way, and re-running would find nothing to anonymise.
   */
  emailService
    .sendAccountDeletedEmail({ to: notify.to, name: notify.name, purgeAfter })
    .catch((err) => logger.warn('Deletion confirmation email failed', { message: err.message }));

  logger.info('Account anonymised', {
    userId: String(userId),
    notificationsRemoved: notifications.deletedCount,
    profilesRemoved: profiles.deletedCount,
    purgeAfter: new Date(now.getTime() + RETENTION_DAYS * 864e5).toISOString(),
  });

  return { anonymizedAt: now, purgeAfter, retentionDays: RETENTION_DAYS };
}

module.exports = { exportUserData, deletionBlockers, anonymizeUser, RETENTION_DAYS };
