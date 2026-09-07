const db = require('../setup/testDb');
const { makeUser, makeExpo, makeSession, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

/** an approved, publicly-visible exhibitor in the directory. */
async function publish(expo, overrides) {
  const user = await makeUser('exhibitor');
  return ExhibitorProfile.create({
    userRef: user.user._id,
    expoRef: expo._id,
    approvalStatus: 'approved',
    ...overrides,
  });
}

describe('Exhibitor directory search', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });

    await publish(expo, {
      companyName: 'Helix Robotics',
      description: 'Collaborative warehouse robots for mid-size logistics operators.',
      category: 'Robotics',
      products: [{ name: 'Helix One picking arm', category: 'Automation', description: 'A six-axis picking arm.' }],
    });
    await publish(expo, {
      companyName: 'Verdant Systems',
      description: 'Building-scale energy monitoring hardware for commercial landlords.',
      category: 'Climate tech',
      products: [{ name: 'Verdant Meter', category: 'Sensors', description: 'A submetering device.' }],
    });
    await publish(expo, {
      companyName: 'Northwind Analytics',
      description: 'Dashboards that turn factory telemetry into maintenance schedules.',
      category: 'Software',
      products: [{ name: 'Northwind Insight', category: 'Analytics', description: 'A telemetry dashboard.' }],
    });
  });

  it('finds an exhibitor by company name', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=Helix`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].companyName).toBe('Helix Robotics');
  });

  it('finds an exhibitor by a word in their description', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=landlords`);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].companyName).toBe('Verdant Systems');
  });

  it('finds an exhibitor by product name, not just company text', async () => {
    // "picking" appears only inside a product, so this proves products are indexed.
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=picking`);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].companyName).toBe('Helix Robotics');
  });

  it('finds an exhibitor by product category', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=Sensors`);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].companyName).toBe('Verdant Systems');
  });

  it('filters by category exactly', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&category=Robotics`);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].companyName).toBe('Helix Robotics');
  });

  it('returns an empty list rather than an error when nothing matches', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=zzzznotathing`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('lists every approved exhibitor when no search is given', async () => {
    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}`);
    expect(res.body.data.items).toHaveLength(3);
  });

  it('keeps unapproved exhibitors out of search results', async () => {
    await publish(expo, {
      companyName: 'Helix Shadow Ltd',
      description: 'A pending applicant that must never surface in a public search.',
      category: 'Robotics',
      approvalStatus: 'pending',
    });

    const res = await request(app).get(`/api/exhibitors?expoRef=${expo._id}&search=Helix`);

    const names = res.body.data.items.map((e) => e.companyName);
    expect(names).toEqual(['Helix Robotics']);
  });
});

describe('Attendee browsing and bookmarking', () => {
  let organizer;
  let expo;
  let attendee;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    attendee = await makeUser('attendee');
  });

  it('lets an attendee browse an expo, its schedule and its directory without signing in', async () => {
    await makeSession(expo, { title: 'Opening Keynote' });
    await publish(expo, {
      companyName: 'Helix Robotics',
      description: 'Collaborative warehouse robots for mid-size logistics operators.',
      category: 'Robotics',
    });

    const expos = await request(app).get('/api/expos');
    expect(expos.body.data.items.map((e) => e.id)).toContain(String(expo._id));

    const detail = await request(app).get(`/api/expos/${expo._id}`);
    expect(detail.status).toBe(200);

    const schedule = await request(app).get(`/api/sessions/expo/${expo._id}`);
    expect(schedule.body.data.items).toHaveLength(1);

    const directory = await request(app).get(`/api/exhibitors?expoRef=${expo._id}`);
    expect(directory.body.data.items).toHaveLength(1);

    const floorPlan = await request(app).get(`/api/booths/expo/${expo._id}`);
    expect(floorPlan.status).toBe(200);
  });

  it('bookmarks three sessions and reflects them in the my-schedule view', async () => {
    const day = new Date(expo.startDate);
    const sessions = await Promise.all([
      makeSession(expo, {
        title: 'Opening Keynote',
        startTime: new Date(new Date(day).setHours(9, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(10, 0, 0, 0)),
      }),
      makeSession(expo, {
        title: 'Robotics Workshop',
        startTime: new Date(new Date(day).setHours(11, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(12, 0, 0, 0)),
      }),
      makeSession(expo, {
        title: 'Closing Panel',
        startTime: new Date(new Date(day).setHours(16, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(17, 0, 0, 0)),
      }),
    ]);

    for (const session of sessions) {
      const res = await as(attendee)
        .post('/api/registrations')
        .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });
      expect(res.status).toBe(201);
    }

    const mine = await as(attendee).get('/api/registrations/me');
    expect(mine.status).toBe(200);
    expect(mine.body.data.items).toHaveLength(3);

    const titles = mine.body.data.items.map((r) => r.sessionRef.title).sort();
    expect(titles).toEqual(['Closing Panel', 'Opening Keynote', 'Robotics Workshop']);
    expect(mine.body.data.items.every((r) => r.bookmarked)).toBe(true);

    const bookmarkedOnly = await as(attendee).get('/api/registrations/me?bookmarked=true');
    expect(bookmarkedOnly.body.data.items).toHaveLength(3);
  });

  it('toggles a bookmark off without cancelling the registration', async () => {
    const session = await makeSession(expo, { capacity: 10 });

    const created = await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });

    const id = created.body.data.registration.id;

    const off = await as(attendee).patch(`/api/registrations/${id}`).send({ bookmarked: false });
    expect(off.status).toBe(200);
    expect(off.body.data.registration.bookmarked).toBe(false);

    // the seat is still held — only the bookmark flag changed.
    const mine = await as(attendee).get('/api/registrations/me');
    expect(mine.body.data.items).toHaveLength(1);
    expect(mine.body.data.items[0].status).toBe('registered');

    const bookmarkedOnly = await as(attendee).get('/api/registrations/me?bookmarked=true');
    expect(bookmarkedOnly.body.data.items).toHaveLength(0);
  });

  it('scopes my-schedule to one expo when asked', async () => {
    const otherExpo = await makeExpo(organizer, { status: 'published', title: 'Another Expo' });
    const here = await makeSession(expo, { title: 'Session Here' });
    const there = await makeSession(otherExpo, { title: 'Session There' });

    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(here._id), bookmarked: true });
    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(otherExpo._id), sessionRef: String(there._id), bookmarked: true });

    const scoped = await as(attendee).get(`/api/registrations/me?expoRef=${expo._id}`);
    expect(scoped.body.data.items).toHaveLength(1);
    expect(scoped.body.data.items[0].sessionRef.title).toBe('Session Here');
  });

  it("never shows one attendee another attendee's schedule", async () => {
    const session = await makeSession(expo, { capacity: 10 });
    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });

    const other = await makeUser('attendee');
    const res = await as(other).get('/api/registrations/me');

    expect(res.body.data.items).toHaveLength(0);
  });
});
