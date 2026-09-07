const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const User = require('../models/User');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const ApiError = require('../utils/ApiError');

/**
 * works out what kind of conversation two roles form, and refuses pairings the
 * SRS does not describe (an attendee messaging another attendee, say).
 */
function kindFor(roleA, roleB) {
  const pair = [roleA, roleB].sort().join('-');

  const KINDS = {
    'attendee-exhibitor': 'attendee-exhibitor',
    'exhibitor-organizer': 'exhibitor-organizer',
    'exhibitor-exhibitor': 'exhibitor-exhibitor',
    // an attendee needing help goes to the organizer through feedback, not chat.
    'attendee-organizer': null,
    'attendee-attendee': null,
    'organizer-organizer': null,
  };

  return KINDS[pair] ?? null;
}

/**
 * finds the existing conversation between two users for an expo, or starts one.
 * participants are stored in a canonical order so the pair always resolves to
 * the same thread rather than forking into two.
 */
async function findOrCreateThread({ senderId, recipientId, expoId = null, subject = '' }) {
  if (String(senderId) === String(recipientId)) {
    throw ApiError.badRequest('You cannot message yourself');
  }

  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select('role name'),
    User.findById(recipientId).select('role name'),
  ]);

  if (!recipient) throw ApiError.notFound('That person does not exist');

  const kind = kindFor(sender.role, recipient.role);
  if (!kind) {
    throw ApiError.forbidden(`A ${sender.role} cannot start a conversation with a ${recipient.role}`);
  }

  const participants = MessageThread.pairKey(senderId, recipientId);
  const pairKey = MessageThread.pairKeyString(senderId, recipientId);

  const existing = await MessageThread.findOne({ pairKey, expoRef: expoId });
  if (existing) return existing;

  return MessageThread.create({
    participants,
    pairKey,
    expoRef: expoId,
    kind,
    subject: subject.slice(0, 160),
  });
}

/** throws unless the user is in the thread — every read and write goes through this. */
function assertParticipant(thread, userId) {
  const inThread = thread.participants.some((p) => String(p._id ?? p) === String(userId));
  if (!inThread) throw ApiError.forbidden('That conversation is not yours');
}

/** unread totals per thread for one user, in a single aggregation. */
async function unreadByThread(userId, threadIds) {
  const rows = await Message.aggregate([
    { $match: { threadRef: { $in: threadIds }, senderRef: { $ne: userId }, readBy: { $ne: userId } } },
    { $group: { _id: '$threadRef', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [String(row._id), row.count]));
}

/**
 * the exhibitors sharing a floor plan with this one — "neighboring exhibitors"
 * from the SRS. everyone approved on the same expo is reachable.
 */
async function neighbouringExhibitors(userId, expoId) {
  const mine = await ExhibitorProfile.findOne({ userRef: userId, expoRef: expoId });
  if (!mine || mine.approvalStatus !== 'approved') return [];

  return ExhibitorProfile.find({
    expoRef: expoId,
    approvalStatus: 'approved',
    _id: { $ne: mine._id },
  })
    .select('companyName category logoUrl userRef')
    .populate({ path: 'userRef', select: 'name' })
    .lean();
}

module.exports = { kindFor, findOrCreateThread, assertParticipant, unreadByThread, neighbouringExhibitors };
