const db = require('../setup/testDb');
const { makeUser, makeExpo, makeSession, as, request, app } = require('../helpers/factories');
const Session = require('../../src/models/Session');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

/** a time on the expo's first day, so sessions land inside its date range. */
const onExpoDay = (expo, hours) => new Date(new Date(expo.startDate).setHours(hours, 0, 0, 0)).toISOString();

describe('Session CRUD', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
  });

  const validSession = () => ({
    expoRef: String(expo._id),
    title: 'Designing for Accessibility',
    speaker: 'Rina Malhotra',
    topic: 'Inclusive design',
    location: 'Workshop Room B',
    startTime: onExpoDay(expo, 10),
    endTime: onExpoDay(expo, 11),
    capacity: 40,
  });

  it('creates a session with speaker, topic, location and time', async () => {
    const res = await as(organizer).post('/api/sessions').send(validSession());

    expect(res.status).toBe(201);
    expect(res.body.data.session).toMatchObject({
      title: 'Designing for Accessibility',
      speaker: 'Rina Malhotra',
      topic: 'Inclusive design',
      location: 'Workshop Room B',
      capacity: 40,
      registeredCount: 0,
    });
  });

  it('treats an empty capacity as unlimited', async () => {
    const res = await as(organizer).post('/api/sessions').send({ ...validSession(), capacity: '' });
    expect(res.status).toBe(201);
    expect(res.body.data.session.capacity).toBeNull();
  });

  it('rejects a session that ends before it starts', async () => {
    const res = await as(organizer)
      .post('/api/sessions')
      .send({ ...validSession(), startTime: onExpoDay(expo, 14), endTime: onExpoDay(expo, 12) });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'endTime')).toBe(true);
  });

  it('rejects a session scheduled outside the expo dates', async () => {
    const wayLater = new Date(new Date(expo.endDate).getTime() + 5 * 24 * 60 * 60 * 1000);
    const res = await as(organizer)
      .post('/api/sessions')
      .send({
        ...validSession(),
        startTime: new Date(wayLater.setHours(10)).toISOString(),
        endTime: new Date(wayLater.setHours(11)).toISOString(),
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expo's own dates/i);
  });

  it('stops an organizer adding sessions to an expo they do not run', async () => {
    const other = await makeUser('organizer');
    const res = await as(other).post('/api/sessions').send(validSession());
    expect(res.status).toBe(403);
  });

  it('refuses session creation from attendees and exhibitors', async () => {
    for (const role of ['attendee', 'exhibitor']) {
      const actor = await makeUser(role);
      expect((await as(actor).post('/api/sessions').send(validSession())).status).toBe(403);
    }
  });

  it('updates a session and returns the schedule in time order', async () => {
    await makeSession(expo, { title: 'Afternoon', startTime: new Date(new Date(expo.startDate).setHours(15, 0, 0, 0)), endTime: new Date(new Date(expo.startDate).setHours(16, 0, 0, 0)) });
    const morning = await makeSession(expo, { title: 'Morning', startTime: new Date(new Date(expo.startDate).setHours(9, 0, 0, 0)), endTime: new Date(new Date(expo.startDate).setHours(10, 0, 0, 0)) });

    const patched = await as(organizer).patch(`/api/sessions/${morning._id}`).send({ speaker: 'New Speaker' });
    expect(patched.status).toBe(200);
    expect(patched.body.data.session.speaker).toBe('New Speaker');

    const list = await request(app).get(`/api/sessions/expo/${expo._id}`);
    expect(list.status).toBe(200);
    expect(list.body.data.items.map((s) => s.title)).toEqual(['Morning', 'Afternoon']);
  });

  it('reports remaining seats on the schedule', async () => {
    const session = await makeSession(expo, { capacity: 3 });
    const attendee = await makeUser('attendee');
    await as(attendee).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });

    const list = await request(app).get(`/api/sessions/expo/${expo._id}`);
    const row = list.body.data.items.find((s) => s.id === String(session._id));
    expect(row.seatsRemaining).toBe(2);
    expect(row.isFull).toBe(false);
  });

  it('deletes a session and its registrations', async () => {
    const session = await makeSession(expo, { capacity: 5 });
    const attendee = await makeUser('attendee');
    await as(attendee).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });

    const res = await as(organizer).delete(`/api/sessions/${session._id}`);
    expect(res.status).toBe(200);
    expect(await Session.findById(session._id)).toBeNull();

    const mine = await as(attendee).get('/api/registrations/me');
    expect(mine.body.data.items).toHaveLength(0);
  });

  it('hides the schedule of an unpublished expo from the public', async () => {
    const draft = await makeExpo(organizer, { status: 'draft' });
    await makeSession(draft);

    expect((await request(app).get(`/api/sessions/expo/${draft._id}`)).status).toBe(404);
    expect((await as(organizer).get(`/api/sessions/expo/${draft._id}`)).status).toBe(200);
  });
});
