const MessageThread = require('../models/MessageThread');
const Message = require('../models/Message');
const Expo = require('../models/Expo');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const messageService = require('../services/messageService');
const { emitToUser } = require('../services/socketService');
const { notify } = require('../services/notificationService');

const participantSelect = 'name role avatarUrl';

/** the other person in a two-party thread. */
const counterpart = (thread, userId) =>
  thread.participants.find((p) => String(p._id ?? p) !== String(userId)) ?? null;

// GET /api/messages/threads
const listThreads = asyncHandler(async (req, res) => {
  const threads = await MessageThread.find({ participants: req.user._id })
    .sort({ lastMessageAt: -1, _id: -1 })
    .populate({ path: 'participants', select: participantSelect })
    .populate({ path: 'expoRef', select: 'title' })
    .lean();

  const unread = await messageService.unreadByThread(
    req.user._id,
    threads.map((t) => t._id)
  );

  const items = threads.map((thread) => ({
    ...thread,
    id: String(thread._id),
    counterpart: counterpart(thread, req.user._id),
    unreadCount: unread.get(String(thread._id)) ?? 0,
  }));

  return ok(
    res,
    { items, totalUnread: items.reduce((sum, t) => sum + t.unreadCount, 0) },
    'Your conversations'
  );
});

// GET /api/messages/thread/:id
const getThread = asyncHandler(async (req, res) => {
  const thread = await MessageThread.findById(req.params.id)
    .populate({ path: 'participants', select: participantSelect })
    .populate({ path: 'expoRef', select: 'title' });

  if (!thread) throw ApiError.notFound('Conversation not found');
  messageService.assertParticipant(thread, req.user._id);

  await Message.updateMany(
    { threadRef: thread._id, senderRef: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );

  const messages = await Message.find({ threadRef: thread._id })
    .sort({ createdAt: 1 })
    .populate({ path: 'senderRef', select: participantSelect })
    .lean();

  return ok(
    res,
    {
      thread: { ...thread.toJSON(), counterpart: counterpart(thread, req.user._id) },
      messages: messages.map((m) => ({ ...m, id: String(m._id) })),
    },
    'Conversation loaded'
  );
});

// POST /api/messages
const sendMessage = asyncHandler(async (req, res) => {
  const { threadRef, recipientRef, expoRef, body, subject } = req.body;

  let thread;

  if (threadRef) {
    thread = await MessageThread.findById(threadRef);
    if (!thread) throw ApiError.notFound('Conversation not found');
    messageService.assertParticipant(thread, req.user._id);
  } else {
    if (!recipientRef) throw ApiError.badRequest('Say who the message is for');

    // a thread pinned to an expo must reference one that actually exists.
    if (expoRef) {
      const expo = await Expo.findById(expoRef).select('_id');
      if (!expo) throw ApiError.notFound('That expo does not exist');
    }

    thread = await messageService.findOrCreateThread({
      senderId: req.user._id,
      recipientId: recipientRef,
      expoId: expoRef ?? null,
      subject: subject ?? '',
    });
  }

  const message = await Message.create({
    threadRef: thread._id,
    senderRef: req.user._id,
    expoRef: thread.expoRef,
    body,
    // the sender has by definition read their own message.
    readBy: [req.user._id],
  });

  thread.lastMessageAt = message.createdAt;
  thread.lastMessagePreview = body.slice(0, 200);
  thread.lastSenderRef = req.user._id;
  await thread.save();

  await message.populate({ path: 'senderRef', select: participantSelect });

  const recipientId = counterpart(thread, req.user._id);
  const payload = {
    threadId: String(thread._id),
    message: message.toJSON(),
    expoId: thread.expoRef ? String(thread.expoRef) : null,
  };

  // push to the recipient, and to the sender's other tabs.
  emitToUser(recipientId, 'message:new', payload);
  emitToUser(req.user._id, 'message:sent', payload);

  await notify({
    userRef: recipientId,
    type: 'message',
    message: `New message from ${req.user.name}`,
    link: `/messages?thread=${thread._id}`,
    expoRef: thread.expoRef,
  });

  return created(res, { message: message.toJSON(), threadId: String(thread._id) }, 'Message sent');
});

// GET /api/messages/contacts?expoRef=
const listContacts = asyncHandler(async (req, res) => {
  const { expoRef } = req.query;
  if (!expoRef) throw ApiError.badRequest('Choose an expo first');

  const expo = await Expo.findById(expoRef).select('title organizerRef status');
  if (!expo) throw ApiError.notFound('That expo does not exist');

  const contacts = [];

  if (req.user.role === 'attendee' || req.user.role === 'exhibitor') {
    // approved exhibitors are reachable by attendees, and by each other.
    const exhibitors = await ExhibitorProfile.find({ expoRef, approvalStatus: 'approved' })
      .select('companyName category logoUrl userRef')
      .populate({ path: 'userRef', select: 'name role' })
      .lean();

    exhibitors
      .filter((profile) => String(profile.userRef?._id) !== String(req.user._id))
      .forEach((profile) => {
        contacts.push({
          userId: String(profile.userRef._id),
          name: profile.companyName,
          subtitle: profile.category,
          avatarUrl: profile.logoUrl,
          group: req.user.role === 'exhibitor' ? 'Neighbouring exhibitors' : 'Exhibitors',
        });
      });
  }

  if (req.user.role === 'exhibitor') {
    // exhibitors can always reach the organizer running the expo, for support.
    const organizer = await Expo.findById(expoRef).populate({ path: 'organizerRef', select: 'name' });
    if (organizer?.organizerRef) {
      contacts.push({
        userId: String(organizer.organizerRef._id),
        name: organizer.organizerRef.name,
        subtitle: 'Organizer — support',
        avatarUrl: null,
        group: 'Organizer',
      });
    }
  }

  return ok(res, { items: contacts }, 'Contacts');
});

module.exports = { listThreads, getThread, sendMessage, listContacts };
