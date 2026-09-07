const db = require('../setup/testDb');
const { makeUser, makeExpo, makeSession, as, request, app, DAY } = require('../helpers/factories');
const Expo = require('../../src/models/Expo');
const Session = require('../../src/models/Session');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

const validExpo = () => ({
  title: 'Sustainable Living Fair 2026',
  description: 'Three days of exhibitors, talks and workshops on sustainable living and green technology.',
  theme: 'Sustainability',
  location: 'Lahore Convention Centre',
  startDate: new Date(Date.now() + 40 * DAY).toISOString(),
  endDate: new Date(Date.now() + 42 * DAY).toISOString(),
});

describe('Expo CRUD', () => {
  let organizer;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
  });

  it('creates an expo and reads it back', async () => {
    const res = await as(organizer).post('/api/expos').send(validExpo());
    expect(res.status).toBe(201);
    expect(res.body.data.expo.title).toBe('Sustainable Living Fair 2026');
    expect(res.body.data.expo.status).toBe('draft');
    // defaults the Phase 3 floor-plan builder relies on.
    expect(res.body.data.expo.floorPlanConfig).toEqual({ gridWidth: 20, gridHeight: 14 });

    const stored = await Expo.findById(res.body.data.expo.id);
    expect(stored).not.toBeNull();
    expect(String(stored.organizerRef)).toBe(organizer.id);
  });

  it('rejects an expo whose end date precedes its start date', async () => {
    const res = await as(organizer)
      .post('/api/expos')
      .send({ ...validExpo(), startDate: new Date(Date.now() + 10 * DAY).toISOString(), endDate: new Date(Date.now() + 5 * DAY).toISOString() });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'endDate')).toBe(true);
  });

  it('rejects a too-short description', async () => {
    const res = await as(organizer).post('/api/expos').send({ ...validExpo(), description: 'Too short' });
    expect(res.status).toBe(400);
  });

  it('refuses expo creation from non-organizers', async () => {
    for (const role of ['attendee', 'exhibitor']) {
      const actor = await makeUser(role);
      const res = await as(actor).post('/api/expos').send(validExpo());
      expect(res.status).toBe(403);
    }
  });

  it('updates an expo and persists the change', async () => {
    const expo = await makeExpo(organizer, { status: 'draft' });

    const res = await as(organizer)
      .patch(`/api/expos/${expo._id}`)
      .send({ title: 'Renamed Expo', status: 'published' });

    expect(res.status).toBe(200);
    expect(res.body.data.expo.title).toBe('Renamed Expo');

    const stored = await Expo.findById(expo._id);
    expect(stored.title).toBe('Renamed Expo');
    expect(stored.status).toBe('published');
  });

  it('stops one organizer editing or deleting another organizer\'s expo', async () => {
    const other = await makeUser('organizer');
    const expo = await makeExpo(other);

    expect((await as(organizer).patch(`/api/expos/${expo._id}`).send({ title: 'Hijacked' })).status).toBe(403);
    expect((await as(organizer).delete(`/api/expos/${expo._id}`)).status).toBe(403);
  });

  it('hides draft expos from the public listing but shows them to their owner', async () => {
    await makeExpo(organizer, { status: 'draft', title: 'Secret Draft' });
    await makeExpo(organizer, { status: 'published', title: 'Public Show' });

    const anonymous = await request(app).get('/api/expos');
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.data.items.map((e) => e.title)).toEqual(['Public Show']);

    const mine = await as(organizer).get('/api/expos?mine=true');
    expect(mine.body.data.items).toHaveLength(2);
  });

  it('returns 404 for a draft expo requested by a stranger', async () => {
    const draft = await makeExpo(organizer, { status: 'draft' });

    expect((await request(app).get(`/api/expos/${draft._id}`)).status).toBe(404);
    expect((await as(organizer).get(`/api/expos/${draft._id}`)).status).toBe(200);
  });

  it('deletes an unused expo along with its draft sessions', async () => {
    const expo = await makeExpo(organizer, { status: 'draft' });
    await makeSession(expo);

    const res = await as(organizer).delete(`/api/expos/${expo._id}`);
    expect(res.status).toBe(200);

    expect(await Expo.findById(expo._id)).toBeNull();
    expect(await Session.countDocuments({ expoRef: expo._id })).toBe(0);
  });

  it('refuses to delete an expo people have already registered for', async () => {
    const expo = await makeExpo(organizer, { status: 'published' });
    const session = await makeSession(expo, { capacity: 10 });
    const attendee = await makeUser('attendee');

    await as(attendee).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });

    const res = await as(organizer).delete(`/api/expos/${expo._id}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cancelled/i);
    expect(await Expo.findById(expo._id)).not.toBeNull();
  });

  it('rejects a malformed expo id before touching the database', async () => {
    const res = await request(app).get('/api/expos/not-an-id');
    expect(res.status).toBe(400);
  });
});
