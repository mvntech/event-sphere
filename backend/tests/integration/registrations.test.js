const db = require('../setup/testDb');
const { makeUser, makeExpo, makeSession, as } = require('../helpers/factories');
const Session = require('../../src/models/Session');
const Registration = require('../../src/models/Registration');
const registrationService = require('../../src/services/registrationService');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

describe('Session capacity enforcement', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
  });

  it('lets attendees register while seats remain, and refuses the one past capacity', async () => {
    const session = await makeSession(expo, { capacity: 2, title: 'Robotics Workshop' });

    const first = await makeUser('attendee');
    const second = await makeUser('attendee');
    const third = await makeUser('attendee');

    const r1 = await as(first).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });
    expect(r1.status).toBe(201);
    expect(r1.body.data.seatsRemaining).toBe(1);

    const r2 = await as(second).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });
    expect(r2.status).toBe(201);
    expect(r2.body.data.seatsRemaining).toBe(0);

    // the third attendee is the one past capacity.
    const r3 = await as(third).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });
    expect(r3.status).toBe(409);
    expect(r3.body.success).toBe(false);
    expect(r3.body.message).toMatch(/full/i);

    const after = await Session.findById(session._id);
    expect(after.registeredCount).toBe(2);
    expect(await Registration.countDocuments({ sessionRef: session._id, status: 'registered' })).toBe(2);
  });

  it('treats a null capacity as unlimited', async () => {
    const session = await makeSession(expo, { capacity: null });

    for (let i = 0; i < 5; i += 1) {
      const attendee = await makeUser('attendee');
      const res = await as(attendee)
        .post('/api/registrations')
        .send({ expoRef: String(expo._id), sessionRef: String(session._id) });
      expect(res.status).toBe(201);
      expect(res.body.data.seatsRemaining).toBeNull();
    }

    expect((await Session.findById(session._id)).registeredCount).toBe(5);
  });

  it('does not oversell the last seat when requests arrive at the same moment', async () => {
    const session = await makeSession(expo, { capacity: 1 });
    const attendees = await Promise.all([makeUser('attendee'), makeUser('attendee'), makeUser('attendee')]);

    const results = await Promise.all(
      attendees.map((a) =>
        as(a).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) })
      )
    );

    // exactly one wins the seat; the counter must match reality either way.
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect((await Session.findById(session._id)).registeredCount).toBe(1);
  });

  it('rejects a second registration from the same attendee', async () => {
    const session = await makeSession(expo, { capacity: 10 });
    const attendee = await makeUser('attendee');
    const body = { expoRef: String(expo._id), sessionRef: String(session._id) };

    expect((await as(attendee).post('/api/registrations').send(body)).status).toBe(201);

    const duplicate = await as(attendee).post('/api/registrations').send(body);
    expect(duplicate.status).toBe(409);
    // the rejected duplicate must not have burned a seat.
    expect((await Session.findById(session._id)).registeredCount).toBe(1);
  });

  it('returns the seat to the pool when a registration is cancelled', async () => {
    const session = await makeSession(expo, { capacity: 1 });
    const first = await makeUser('attendee');
    const second = await makeUser('attendee');
    const body = { expoRef: String(expo._id), sessionRef: String(session._id) };

    const created = await as(first).post('/api/registrations').send(body);
    expect(created.status).toBe(201);

    // full, so the second attendee is turned away.
    expect((await as(second).post('/api/registrations').send(body)).status).toBe(409);

    const cancelled = await as(first).delete(`/api/registrations/${created.body.data.registration.id}`);
    expect(cancelled.status).toBe(200);
    expect((await Session.findById(session._id)).registeredCount).toBe(0);

    // the freed seat is now claimable.
    expect((await as(second).post('/api/registrations').send(body)).status).toBe(201);
  });

  it('stops an organizer shrinking capacity below the seats already taken', async () => {
    const session = await makeSession(expo, { capacity: 5 });
    const attendee = await makeUser('attendee');
    await as(attendee).post('/api/registrations').send({ expoRef: String(expo._id), sessionRef: String(session._id) });

    const shrink = await as(organizer).patch(`/api/sessions/${session._id}`).send({ capacity: 0 });
    expect(shrink.status).toBe(400); // 0 fails the "at least 1" rule outright

    const shrinkToZeroSeats = await as(organizer).patch(`/api/sessions/${session._id}`).send({ capacity: 1 });
    expect(shrinkToZeroSeats.status).toBe(200);

    // raising is fine; dropping below the 1 taken seat is not — verified directly.
    await expect(registrationService.assertCapacityFitsExisting(session._id, 0)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('refuses registration for an unpublished expo', async () => {
    const draft = await makeExpo(organizer, { status: 'draft' });
    const session = await makeSession(draft, { capacity: 10 });
    const attendee = await makeUser('attendee');

    const res = await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(draft._id), sessionRef: String(session._id) });

    expect(res.status).toBe(400);
  });

  it('only lets attendees register', async () => {
    const session = await makeSession(expo, { capacity: 10 });
    const exhibitor = await makeUser('exhibitor');

    const res = await as(exhibitor)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id) });

    expect(res.status).toBe(403);
  });
});
