const db = require('../setup/testDb');
const { makeUser, makeExpo, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const MessageThread = require('../../src/models/MessageThread');
const Message = require('../../src/models/Message');
const Notification = require('../../src/models/Notification');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

async function makeApprovedExhibitor(expo, companyName = 'Helix Robotics') {
  const user = await makeUser('exhibitor');
  const profile = await ExhibitorProfile.create({
    userRef: user.user._id,
    expoRef: expo._id,
    companyName,
    description: 'We build collaborative warehouse robots for logistics operators.',
    category: 'Robotics',
    approvalStatus: 'approved',
  });
  return { ...user, profile };
}

describe('Attendee to exhibitor messaging', () => {
  let organizer;
  let expo;
  let exhibitor;
  let attendee;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    exhibitor = await makeApprovedExhibitor(expo);
    attendee = await makeUser('attendee');
  });

  it('starts a thread, delivers the message and notifies the exhibitor', async () => {
    const res = await as(attendee).post('/api/messages').send({
      recipientRef: exhibitor.id,
      expoRef: String(expo._id),
      body: 'Do you have a demo of the picking arm running on the stand?',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.threadId).toBeTruthy();

    // it lands in the exhibitor's inbox.
    const inbox = await as(exhibitor).get('/api/messages/threads');
    expect(inbox.body.data.items).toHaveLength(1);
    expect(inbox.body.data.items[0].unreadCount).toBe(1);
    expect(inbox.body.data.totalUnread).toBe(1);
    expect(inbox.body.data.items[0].counterpart.name).toBe(attendee.user.name);

    // and raises an in-app notification.
    const notification = await Notification.findOne({ userRef: exhibitor.user._id, type: 'message' });
    expect(notification).not.toBeNull();
    expect(notification.message).toMatch(attendee.user.name);
  });

  it('keeps replies in the same thread rather than forking a new one', async () => {
    const first = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'Is the stand staffed all three days?' });

    const reply = await as(exhibitor)
      .post('/api/messages')
      .send({ threadRef: first.body.data.threadId, body: 'Yes, we are there from 9 to 6 each day.' });

    expect(reply.status).toBe(201);

    // a second opening message from the attendee must reuse the thread too.
    const second = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'Great, see you there.' });

    expect(second.body.data.threadId).toBe(first.body.data.threadId);
    expect(await MessageThread.countDocuments()).toBe(1);
    expect(await Message.countDocuments()).toBe(3);
  });

  it('marks incoming messages read when the thread is opened', async () => {
    const sent = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'A question about your products.' });

    const threadId = sent.body.data.threadId;

    const opened = await as(exhibitor).get(`/api/messages/thread/${threadId}`);
    expect(opened.status).toBe(200);
    expect(opened.body.data.messages).toHaveLength(1);

    const after = await as(exhibitor).get('/api/messages/threads');
    expect(after.body.data.items[0].unreadCount).toBe(0);

    // the sender's own message never counts as unread for them.
    const senderInbox = await as(attendee).get('/api/messages/threads');
    expect(senderInbox.body.data.items[0].unreadCount).toBe(0);
  });

  it('shows the newest conversation first', async () => {
    const other = await makeApprovedExhibitor(expo, 'Verdant Systems');

    await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'First conversation opened here.' });
    await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: other.id, expoRef: String(expo._id), body: 'Second conversation opened here.' });

    const inbox = await as(attendee).get('/api/messages/threads');
    expect(inbox.body.data.items[0].lastMessagePreview).toMatch(/Second conversation/);
  });

  it('stops an outsider reading a conversation they are not in', async () => {
    const sent = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'A private enquiry about pricing.' });

    const nosy = await makeUser('attendee');
    const res = await as(nosy).get(`/api/messages/thread/${sent.body.data.threadId}`);

    expect(res.status).toBe(403);
  });

  it('stops an outsider posting into a conversation they are not in', async () => {
    const sent = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: 'A private enquiry about pricing.' });

    const nosy = await makeUser('attendee');
    const res = await as(nosy)
      .post('/api/messages')
      .send({ threadRef: sent.body.data.threadId, body: 'Butting in on a thread that is not mine.' });

    expect(res.status).toBe(403);
    expect(await Message.countDocuments()).toBe(1);
  });

  it('rejects an empty message', async () => {
    const res = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: exhibitor.id, expoRef: String(expo._id), body: '   ' });

    expect(res.status).toBe(400);
  });

  it('rejects a message with no recipient and no thread', async () => {
    const res = await as(attendee).post('/api/messages').send({ body: 'Floating in the void.' });
    expect(res.status).toBe(400);
  });

  it('refuses to let someone message themselves', async () => {
    const res = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: attendee.id, expoRef: String(expo._id), body: 'Talking to myself here.' });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/messages/threads');
    expect(res.status).toBe(401);
  });
});

describe('Conversation pairings the SRS allows', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
  });

  it('lets an exhibitor open a support thread with the organizer', async () => {
    const exhibitor = await makeApprovedExhibitor(expo);

    const res = await as(exhibitor)
      .post('/api/messages')
      .send({ recipientRef: organizer.id, expoRef: String(expo._id), body: 'Can we get extra power at the stand?' });

    expect(res.status).toBe(201);
    const thread = await MessageThread.findById(res.body.data.threadId);
    expect(thread.kind).toBe('exhibitor-organizer');
  });

  it('lets neighboring exhibitors contact each other', async () => {
    const first = await makeApprovedExhibitor(expo, 'Helix Robotics');
    const second = await makeApprovedExhibitor(expo, 'Verdant Systems');

    const res = await as(first)
      .post('/api/messages')
      .send({ recipientRef: second.id, expoRef: String(expo._id), body: 'Fancy sharing a coffee run on day two?' });

    expect(res.status).toBe(201);
    const thread = await MessageThread.findById(res.body.data.threadId);
    expect(thread.kind).toBe('exhibitor-exhibitor');
  });

  it('refuses an attendee-to-attendee conversation', async () => {
    const one = await makeUser('attendee');
    const two = await makeUser('attendee');

    const res = await as(one)
      .post('/api/messages')
      .send({ recipientRef: two.id, expoRef: String(expo._id), body: 'Hello fellow attendee.' });

    expect(res.status).toBe(403);
    expect(await MessageThread.countDocuments()).toBe(0);
  });

  it('refuses an attendee-to-organizer conversation, steering them to feedback', async () => {
    const attendee = await makeUser('attendee');

    const res = await as(attendee)
      .post('/api/messages')
      .send({ recipientRef: organizer.id, expoRef: String(expo._id), body: 'A question for the organizer.' });

    expect(res.status).toBe(403);
  });
});

describe('Contact directory', () => {
  it('offers approved exhibitors to an attendee, and the organizer to an exhibitor', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const approved = await makeApprovedExhibitor(expo, 'Helix Robotics');

    // a pending applicant must not appear as contactable.
    const pendingUser = await makeUser('exhibitor');
    await ExhibitorProfile.create({
      userRef: pendingUser.user._id,
      expoRef: expo._id,
      companyName: 'Still Pending Ltd',
      description: 'An application that has not been reviewed yet at all.',
      category: 'Robotics',
      approvalStatus: 'pending',
    });

    const attendee = await makeUser('attendee');
    const forAttendee = await as(attendee).get(`/api/messages/contacts?expoRef=${expo._id}`);

    const names = forAttendee.body.data.items.map((c) => c.name);
    expect(names).toContain('Helix Robotics');
    expect(names).not.toContain('Still Pending Ltd');

    const forExhibitor = await as(approved).get(`/api/messages/contacts?expoRef=${expo._id}`);
    const groups = forExhibitor.body.data.items.map((c) => c.group);
    expect(groups).toContain('Organizer');
    // An exhibitor never lists themselves as a contact.
    expect(forExhibitor.body.data.items.map((c) => c.name)).not.toContain('Helix Robotics');
  });
});
