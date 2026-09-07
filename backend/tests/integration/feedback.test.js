const db = require('../setup/testDb');
const { makeUser, makeExpo, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const Feedback = require('../../src/models/Feedback');
const Notification = require('../../src/models/Notification');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('Feedback submission and the organizer inbox', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
  });

  it('accepts feedback from every role and shows it in the organizer inbox', async () => {
    const roles = ['attendee', 'exhibitor', 'organizer'];

    for (const role of roles) {
      const actor = role === 'organizer' ? organizer : await makeUser(role);
      const res = await as(actor)
        .post('/api/feedback')
        .send({
          expoRef: String(expo._id),
          content: `Feedback submitted by a ${role} about how the expo went overall.`,
          category: 'general',
        });

      expect(res.status).toBe(201);
    }

    const inbox = await as(organizer).get('/api/feedback');
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.items).toHaveLength(3);
    expect(inbox.body.data.counts.new).toBe(3);
    // the inbox names who said it, so the organizer can follow up.
    expect(inbox.body.data.items[0].userRef.name).toBeTruthy();
  });

  it('notifies the organizer when feedback arrives', async () => {
    const attendee = await makeUser('attendee');

    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'The signage near the robotics hall was hard to follow.' });

    const notification = await Notification.findOne({ userRef: organizer.user._id, type: 'feedback' });
    expect(notification).not.toBeNull();
    expect(notification.message).toMatch(expo.title);
    expect(notification.link).toBe('/organizer/feedback');
  });

  it('stores a rating and category alongside the text', async () => {
    const attendee = await makeUser('attendee');

    const res = await as(attendee).post('/api/feedback').send({
      expoRef: String(expo._id),
      content: 'The keynote was excellent and the room was the right size for it.',
      category: 'session',
      rating: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.feedback.category).toBe('session');
    expect(res.body.data.feedback.rating).toBe(5);
    // AI tagging is Phase 5 — these stay null rather than being guessed here.
    expect(res.body.data.feedback.aiSentiment).toBeNull();
    expect(res.body.data.feedback.aiCategory).toBeNull();
  });

  it('rejects feedback that is too short to be useful', async () => {
    const attendee = await makeUser('attendee');

    const res = await as(attendee).post('/api/feedback').send({ expoRef: String(expo._id), content: 'meh' });

    expect(res.status).toBe(400);
    expect(await Feedback.countDocuments()).toBe(0);
  });

  it('rejects an unknown category', async () => {
    const attendee = await makeUser('attendee');

    const res = await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'A perfectly reasonable piece of feedback.', category: 'nonsense' });

    expect(res.status).toBe(400);
  });

  it('never shows one organizer another organizer\'s feedback', async () => {
    const attendee = await makeUser('attendee');
    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Feedback that belongs to the first organizer only.' });

    const other = await makeUser('organizer');
    const res = await as(other).get('/api/feedback');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('refuses to filter by an expo the organizer does not run', async () => {
    const other = await makeUser('organizer');
    const res = await as(other).get(`/api/feedback?expoRef=${expo._id}`);

    expect(res.status).toBe(403);
  });

  it('keeps the inbox closed to attendees and exhibitors', async () => {
    for (const role of ['attendee', 'exhibitor']) {
      const actor = await makeUser(role);
      expect((await as(actor).get('/api/feedback')).status).toBe(403);
    }
  });

  it('lets the organizer triage an item and filter by status', async () => {
    const attendee = await makeUser('attendee');
    const submitted = await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'The wifi in the west hall dropped out repeatedly.' });

    const id = submitted.body.data.feedback.id;

    const triaged = await as(organizer)
      .patch(`/api/feedback/${id}`)
      .send({ status: 'resolved', organizerNote: 'Venue has added a second access point.' });

    expect(triaged.status).toBe(200);
    expect(triaged.body.data.feedback.status).toBe('resolved');

    const resolved = await as(organizer).get('/api/feedback?status=resolved');
    expect(resolved.body.data.items).toHaveLength(1);

    const stillNew = await as(organizer).get('/api/feedback?status=new');
    expect(stillNew.body.data.items).toHaveLength(0);
  });

  it("stops an organizer triaging another organizer's feedback", async () => {
    const attendee = await makeUser('attendee');
    const submitted = await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Feedback that only the owning organizer may triage.' });

    const other = await makeUser('organizer');
    const res = await as(other)
      .patch(`/api/feedback/${submitted.body.data.feedback.id}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(403);
  });

  it('lets a user see their own submissions back', async () => {
    const attendee = await makeUser('attendee');
    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'My own feedback, which I should be able to read back.' });

    const mine = await as(attendee).get('/api/feedback/me');
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(1);
  });

  it('requires authentication to submit', async () => {
    const res = await request(app).post('/api/feedback').send({ content: 'Anonymous feedback attempt goes here.' });
    expect(res.status).toBe(401);
  });
});

describe('Notification centre', () => {
  it('lists notifications newest first with an unread count, and marks them read', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    // Two real triggers, rather than hand-written documents.
    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'First piece of feedback for the organizer to see.' });
    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Second piece of feedback for the organizer to see.' });

    const list = await as(organizer).get('/api/notifications');
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(2);
    expect(list.body.data.unreadCount).toBe(2);

    const first = list.body.data.items[0];
    const marked = await as(organizer).patch(`/api/notifications/${first.id}/read`);
    expect(marked.status).toBe(200);
    expect(marked.body.data.notification.read).toBe(true);

    const unreadOnly = await as(organizer).get('/api/notifications?unread=true');
    expect(unreadOnly.body.data.items).toHaveLength(1);
    expect(unreadOnly.body.data.unreadCount).toBe(1);

    const allRead = await as(organizer).patch('/api/notifications/read-all');
    expect(allRead.status).toBe(200);
    expect((await as(organizer).get('/api/notifications')).body.data.unreadCount).toBe(0);
  });

  it('never shows one user another user\'s notifications', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Feedback that notifies only the owning organizer.' });

    const other = await makeUser('organizer');
    const res = await as(other).get('/api/notifications');

    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.unreadCount).toBe(0);
  });

  it('raises an approval notification the exhibitor can see', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const exhibitorUser = await makeUser('exhibitor');

    const profile = await ExhibitorProfile.create({
      userRef: exhibitorUser.user._id,
      expoRef: expo._id,
      companyName: 'Helix Robotics',
      description: 'We build collaborative warehouse robots for logistics operators.',
      category: 'Robotics',
    });

    await as(organizer)
      .patch(`/api/exhibitors/${profile._id}/status`)
      .send({ approvalStatus: 'approved', reviewNote: 'Approved for the robotics hall.' });

    const bell = await as(exhibitorUser).get('/api/notifications');
    expect(bell.body.data.unreadCount).toBe(1);
    expect(bell.body.data.items[0].type).toBe('exhibitor-approved');
    expect(bell.body.data.items[0].link).toBe('/exhibitor/booth');
  });

  it('refuses to mark a notification belonging to someone else', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Feedback raising a notification for the organizer.' });

    const list = await as(organizer).get('/api/notifications');
    const other = await makeUser('organizer');

    const res = await as(other).patch(`/api/notifications/${list.body.data.items[0].id}/read`);
    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/notifications')).status).toBe(401);
  });
});
