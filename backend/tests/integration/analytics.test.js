const db = require('../setup/testDb');
const { makeUser, makeExpo, makeSession, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const AnalyticsEvent = require('../../src/models/AnalyticsEvent');
const { fillDailySeries } = require('../../src/services/analyticsService');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

/** event recording is fire-and-forget, so give it a beat to land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

async function approvedExhibitor(expo, companyName = 'Helix Robotics') {
  const user = await makeUser('exhibitor');
  const profile = await ExhibitorProfile.create({
    userRef: user.user._id,
    expoRef: expo._id,
    companyName,
    description: 'Collaborative warehouse robots for mid-size logistics operators.',
    category: 'Robotics',
    products: [{ name: 'Helix One picking arm', category: 'Automation' }],
    approvalStatus: 'approved',
  });
  return { ...user, profile };
}

describe('Analytics event instrumentation', () => {
  let organizer;
  let expo;
  let attendee;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    attendee = await makeUser('attendee');
  });

  it('records a sessionBookmark when an attendee bookmarks a session', async () => {
    const session = await makeSession(expo, { capacity: 20 });

    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });
    await settle();

    const events = await AnalyticsEvent.find({ expoRef: expo._id, type: 'sessionBookmark' });
    expect(events).toHaveLength(1);
    expect(String(events[0].targetRef)).toBe(String(session._id));
    expect(String(events[0].userRef)).toBe(attendee.id);
  });

  it('does not record a bookmark event for a plain registration', async () => {
    const session = await makeSession(expo, { capacity: 20 });

    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: false });
    await settle();

    expect(await AnalyticsEvent.countDocuments({ type: 'sessionBookmark' })).toBe(0);
  });

  it('records a bookmark when one is toggled on later, but not when toggled off', async () => {
    const session = await makeSession(expo, { capacity: 20 });

    const created = await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: false });
    const id = created.body.data.registration.id;

    await as(attendee).patch(`/api/registrations/${id}`).send({ bookmarked: true });
    await settle();
    expect(await AnalyticsEvent.countDocuments({ type: 'sessionBookmark' })).toBe(1);

    await as(attendee).patch(`/api/registrations/${id}`).send({ bookmarked: false });
    await settle();
    // removing interest is not new interest.
    expect(await AnalyticsEvent.countDocuments({ type: 'sessionBookmark' })).toBe(1);
  });

  it('records a profileView when someone opens an exhibitor profile', async () => {
    const exhibitor = await approvedExhibitor(expo);

    await as(attendee).get(`/api/exhibitors/${exhibitor.profile._id}`);
    await settle();

    const events = await AnalyticsEvent.find({ type: 'profileView' });
    expect(events).toHaveLength(1);
    expect(String(events[0].targetRef)).toBe(String(exhibitor.profile._id));
  });

  it('counts a signed-out visitor viewing a profile, without a user id', async () => {
    const exhibitor = await approvedExhibitor(expo);

    await request(app).get(`/api/exhibitors/${exhibitor.profile._id}`);
    await settle();

    const event = await AnalyticsEvent.findOne({ type: 'profileView' });
    expect(event).not.toBeNull();
    expect(event.userRef).toBeNull();
  });

  it('does not count an exhibitor viewing their own profile', async () => {
    const exhibitor = await approvedExhibitor(expo);

    await as(exhibitor).get(`/api/exhibitors/${exhibitor.profile._id}`);
    await settle();

    expect(await AnalyticsEvent.countDocuments({ type: 'profileView' })).toBe(0);
  });

  it('records a search with the query when the directory is searched', async () => {
    await approvedExhibitor(expo);

    await as(attendee).get(`/api/exhibitors?expoRef=${expo._id}&search=picking%20arm`);
    await settle();

    const event = await AnalyticsEvent.findOne({ type: 'search' });
    expect(event).not.toBeNull();
    expect(event.query).toBe('picking arm');
  });

  it('does not record a search when the organizer filters their own queue', async () => {
    await approvedExhibitor(expo);

    await as(organizer).get(`/api/exhibitors?expoRef=${expo._id}&search=Helix`);
    await settle();

    expect(await AnalyticsEvent.countDocuments({ type: 'search' })).toBe(0);
  });

  it('does not record a search when browsing without a query', async () => {
    await approvedExhibitor(expo);

    await as(attendee).get(`/api/exhibitors?expoRef=${expo._id}`);
    await settle();

    expect(await AnalyticsEvent.countDocuments({ type: 'search' })).toBe(0);
  });
});

describe('Client-reported booth views', () => {
  let organizer;
  let expo;
  let boothId;
  let attendee;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    attendee = await makeUser('attendee');

    const res = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), label: 'A1', x: 0, y: 0, width: 2, height: 2 });
    boothId = res.body.data.booth.id;
  });

  it('records a booth view reported by an attendee', async () => {
    const res = await as(attendee)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'boothView', targetRef: boothId });

    expect(res.status).toBe(201);
    await settle();

    const event = await AnalyticsEvent.findOne({ type: 'boothView' });
    expect(String(event.targetRef)).toBe(boothId);
    expect(String(event.userRef)).toBe(attendee.id);
  });

  it('records a booth view from a signed-out visitor', async () => {
    const res = await request(app)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'boothView', targetRef: boothId });

    expect(res.status).toBe(201);
    await settle();
    expect(await AnalyticsEvent.countDocuments({ type: 'boothView' })).toBe(1);
  });

  it('does not count the organizer browsing their own floor plan', async () => {
    const res = await as(organizer)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'boothView', targetRef: boothId });

    expect(res.status).toBe(200);
    expect(res.body.data.recorded).toBe(false);
    await settle();
    expect(await AnalyticsEvent.countDocuments({ type: 'boothView' })).toBe(0);
  });

  it('refuses event types the client is not allowed to report', async () => {
    // otherwise anyone could inflate their own bookmark or search numbers.
    for (const type of ['sessionBookmark', 'profileView', 'search']) {
      const res = await as(attendee)
        .post('/api/analytics/events')
        .send({ expoRef: String(expo._id), type, targetRef: boothId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not an event the client may report/i);
    }

    await settle();
    expect(await AnalyticsEvent.countDocuments()).toBe(0);
  });

  it('rejects an unknown event type outright', async () => {
    const res = await as(attendee)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'somethingElse', targetRef: boothId });

    expect(res.status).toBe(400);
  });

  it('hides a draft expo from event reporting', async () => {
    const draft = await makeExpo(organizer, { status: 'draft' });

    const res = await as(attendee)
      .post('/api/analytics/events')
      .send({ expoRef: String(draft._id), type: 'boothView', targetRef: boothId });

    expect(res.status).toBe(404);
  });
});

describe('Organizer analytics dashboard', () => {
  let organizer;
  let expo;
  let attendee;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    attendee = await makeUser('attendee');
  });

  it('returns a complete, zeroed dashboard for a brand-new expo', async () => {
    const res = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary`);

    expect(res.status).toBe(200);
    const d = res.body.data;

    // charts must render on an empty expo, so every series has to exist.
    expect(d.totals.allEvents).toBe(0);
    expect(d.totals.uniqueVisitors).toBe(0);
    expect(Array.isArray(d.engagement)).toBe(true);
    expect(d.engagement).toHaveLength(14);
    expect(d.engagement.every((day) => day.total === 0)).toBe(true);
    expect(d.boothTraffic).toEqual([]);
    expect(d.sessionPopularity).toEqual([]);
    expect(d.exhibitorViews).toEqual([]);
    expect(d.topSearches).toEqual([]);
    expect(d.booths.occupancy).toBe(0);
  });

  it('moves the numbers when an attendee actually does things', async () => {
    const session = await makeSession(expo, { capacity: 20, title: 'Robotics Workshop' });
    const exhibitor = await approvedExhibitor(expo);
    const boothRes = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), label: 'A1', x: 0, y: 0, width: 2, height: 2 });

    const before = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary`);
    expect(before.body.data.totals.allEvents).toBe(0);

    // a realistic attendee session.
    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });
    await as(attendee).get(`/api/exhibitors/${exhibitor.profile._id}`);
    await as(attendee).get(`/api/exhibitors?expoRef=${expo._id}&search=robots`);
    await as(attendee)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'boothView', targetRef: boothRes.body.data.booth.id });
    await settle();

    const after = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary`);
    const d = after.body.data;

    expect(d.totals.allEvents).toBe(4);
    expect(d.totals.sessionBookmark).toBe(1);
    expect(d.totals.profileView).toBe(1);
    expect(d.totals.search).toBe(1);
    expect(d.totals.boothView).toBe(1);
    expect(d.totals.uniqueVisitors).toBe(1);

    // and the breakdowns name the right things.
    expect(d.boothTraffic[0]).toMatchObject({ label: 'A1', views: 1, visitors: 1 });
    expect(d.sessionPopularity[0]).toMatchObject({ title: 'Robotics Workshop', bookmarks: 1, registrations: 1 });
    expect(d.exhibitorViews[0]).toMatchObject({ companyName: 'Helix Robotics', views: 1 });
    expect(d.topSearches[0]).toMatchObject({ query: 'robots', count: 1 });

    // today's bucket carries the activity.
    expect(d.engagement[d.engagement.length - 1].total).toBe(4);
  });

  it('ranks booths by traffic and counts distinct visitors', async () => {
    const busy = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), label: 'A1', x: 0, y: 0, width: 2, height: 2 });
    const quiet = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), label: 'A2', x: 6, y: 6, width: 2, height: 2 });

    const second = await makeUser('attendee');

    // two people view A1 (one of them twice); one person views A2.
    for (const actor of [attendee, attendee, second]) {
      await as(actor)
        .post('/api/analytics/events')
        .send({ expoRef: String(expo._id), type: 'boothView', targetRef: busy.body.data.booth.id });
    }
    await as(second)
      .post('/api/analytics/events')
      .send({ expoRef: String(expo._id), type: 'boothView', targetRef: quiet.body.data.booth.id });
    await settle();

    const res = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary`);
    const traffic = res.body.data.boothTraffic;

    expect(traffic[0].label).toBe('A1');
    expect(traffic[0].views).toBe(3);
    // three views, but only two distinct people.
    expect(traffic[0].visitors).toBe(2);
    expect(traffic[1]).toMatchObject({ label: 'A2', views: 1, visitors: 1 });
  });

  it('reports booth occupancy from real booth statuses', async () => {
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), label: 'A1', x: 0, y: 0, width: 2, height: 2 });
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), label: 'A2', x: 6, y: 0, width: 2, height: 2 });

    const exhibitor = await approvedExhibitor(expo);
    const booths = await as(organizer).get(`/api/booths/expo/${expo._id}`);
    await as(exhibitor).patch(`/api/booths/${booths.body.data.items[0].id}/reserve`);

    const res = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary`);

    expect(res.body.data.booths).toMatchObject({ total: 2, available: 1, reserved: 1, assigned: 0, occupancy: 50 });
  });

  it('honours the day window and always returns a continuous series', async () => {
    const res = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary?days=30`);

    expect(res.body.data.windowDays).toBe(30);
    expect(res.body.data.engagement).toHaveLength(30);

    // no gaps: every day between the ends is present exactly once.
    const dates = res.body.data.engagement.map((d) => d.date);
    expect(new Set(dates).size).toBe(30);
    expect([...dates].sort()).toEqual(dates);
  });

  it('clamps an absurd day window rather than melting the database', async () => {
    const tooBig = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary?days=9999`);
    expect(tooBig.body.data.windowDays).toBe(90);

    const tooSmall = await as(organizer).get(`/api/analytics/expo/${expo._id}/summary?days=1`);
    expect(tooSmall.body.data.windowDays).toBe(7);
  });

  it('exposes the raw event log, newest first', async () => {
    const session = await makeSession(expo, { capacity: 10 });
    await as(attendee)
      .post('/api/registrations')
      .send({ expoRef: String(expo._id), sessionRef: String(session._id), bookmarked: true });
    await settle();

    const res = await as(organizer).get(`/api/analytics/expo/${expo._id}/events`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].type).toBe('sessionBookmark');
    expect(res.body.data.items[0].userRef.name).toBe(attendee.user.name);
  });

  it("never shows one organizer another organizer's analytics", async () => {
    const other = await makeUser('organizer');

    expect((await as(other).get(`/api/analytics/expo/${expo._id}/summary`)).status).toBe(403);
    expect((await as(other).get(`/api/analytics/expo/${expo._id}/events`)).status).toBe(403);
  });

  it('is closed to attendees and exhibitors', async () => {
    for (const role of ['attendee', 'exhibitor']) {
      const actor = await makeUser(role);
      expect((await as(actor).get(`/api/analytics/expo/${expo._id}/summary`)).status).toBe(403);
    }
  });

  it('requires authentication', async () => {
    expect((await request(app).get(`/api/analytics/expo/${expo._id}/summary`)).status).toBe(401);
  });
});

describe('Daily series helper', () => {
  it('fills every missing day with zeroes so a chart has no gaps', () => {
    // keys are UTC-based, matching how Mongo's $dateToString groups.
    const now = new Date();
    const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .slice(0, 10);

    const series = fillDailySeries([{ _id: key, boothView: 5, total: 5 }], 7);

    expect(series).toHaveLength(7);
    expect(series[6]).toMatchObject({ date: key, boothView: 5, total: 5 });
    expect(series.slice(0, 6).every((day) => day.total === 0)).toBe(true);
    // every bucket carries all four series, so the chart never sees undefined.
    expect(series[0]).toMatchObject({ boothView: 0, sessionBookmark: 0, profileView: 0, search: 0 });
  });
});
