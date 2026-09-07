const db = require('../setup/testDb');
const { makeUser, makeExpo, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const { resetCache } = require('../../src/controllers/statsController');

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  // the five-minute memo is module state, so it outlives db.clear() and would
  // otherwise carry one test's counts into the next.
  resetCache();
});
afterAll(db.disconnect);

const get = () => request(app).get('/api/stats/public');

async function exhibitor(expo, approvalStatus) {
  const { user } = await makeUser('exhibitor');
  return ExhibitorProfile.create({
    userRef: user._id,
    expoRef: expo._id,
    companyName: `Helix ${String(user._id).slice(-6)}`,
    description: 'Collaborative warehouse robots for mid-size logistics operators.',
    category: 'Robotics',
    approvalStatus,
  });
}

describe('GET /api/stats/public', () => {
  it('is reachable without a token', async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ expos: 0, exhibitors: 0, attendees: 0 });
  });

  it('leaks nothing beyond the three counts', async () => {
    const organizer = await makeUser('organizer');
    await makeExpo(organizer, { title: 'Sustainable Living Fair' });

    const res = await get();

    // the guarantee is the shape itself: no names, no ids, no per-expo
    // breakdown can reach an anonymous caller through this route.
    expect(Object.keys(res.body.data).sort()).toEqual(['attendees', 'exhibitors', 'expos']);
    expect(JSON.stringify(res.body)).not.toContain('Sustainable Living Fair');
  });

  it('counts published and completed expos but not drafts', async () => {
    const organizer = await makeUser('organizer');
    await makeExpo(organizer, { status: 'published' });
    await makeExpo(organizer, { status: 'completed' });
    await makeExpo(organizer, { status: 'draft' });

    const res = await get();

    // a draft is invisible on the listing, so counting it here would make the
    // landing page contradict the page it links to.
    expect(res.body.data.expos).toBe(2);
  });

  it('counts only approved exhibitors', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer);
    await exhibitor(expo, 'approved');
    await exhibitor(expo, 'pending');
    await exhibitor(expo, 'rejected');

    const res = await get();

    // must agree with the expo teaser's "N companies confirmed", which uses
    // this same rule.
    expect(res.body.data.exhibitors).toBe(1);
  });

  it('counts attendees only, and not those pending deletion', async () => {
    await makeUser('attendee');
    const leaving = await makeUser('attendee');
    leaving.user.deletionRequestedAt = new Date();
    await leaving.user.save();
    await makeUser('organizer');
    await makeUser('exhibitor');

    const res = await get();

    expect(res.body.data.attendees).toBe(1);
  });

  it('serves a second call from the memo rather than re-counting', async () => {
    const organizer = await makeUser('organizer');
    await makeExpo(organizer);

    const first = await get();
    expect(first.body.data.expos).toBe(1);

    // a new expo lands inside the window; the cached answer must not move,
    // which is what proves the second call never reached the database.
    await makeExpo(organizer);
    const second = await get();

    expect(second.body.data.expos).toBe(1);
    expect(second.body.message).toMatch(/cached/i);
  });

  it('re-counts once the memo is cleared', async () => {
    const organizer = await makeUser('organizer');
    await makeExpo(organizer);
    await get();

    await makeExpo(organizer);
    resetCache();
    const res = await get();

    expect(res.body.data.expos).toBe(2);
    expect(res.body.message).not.toMatch(/cached/i);
  });
});
