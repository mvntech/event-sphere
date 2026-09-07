const db = require('../setup/testDb');
const { makeUser, makeExpo, as, request, app } = require('../helpers/factories');
const Booth = require('../../src/models/Booth');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const { rectsOverlap } = require('../../src/services/boothService');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.disconnect);

/** an approved exhibitor for the given expo — the state reservation requires. */
async function makeApprovedExhibitor(expo, overrides = {}) {
  const user = await makeUser('exhibitor');
  const profile = await ExhibitorProfile.create({
    userRef: user.user._id,
    expoRef: expo._id,
    companyName: overrides.companyName ?? 'Helix Robotics',
    description: 'We build collaborative warehouse robots for logistics operators.',
    category: 'Robotics',
    approvalStatus: overrides.approvalStatus ?? 'approved',
  });
  return { ...user, profile };
}

const booth = (label, x, y, width = 2, height = 2) => ({ label, x, y, width, height });

describe('Booth geometry', () => {
  it('treats flush-adjacent booths as non-overlapping', () => {
    // a occupies cells 0-1; B starts at 2. they touch but do not overlap.
    expect(rectsOverlap({ x: 0, y: 0, width: 2, height: 2 }, { x: 2, y: 0, width: 2, height: 2 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, width: 2, height: 2 }, { x: 0, y: 2, width: 2, height: 2 })).toBe(false);
  });

  it('detects partial, nested and identical overlaps', () => {
    const base = { x: 2, y: 2, width: 4, height: 4 };
    expect(rectsOverlap(base, { x: 5, y: 5, width: 2, height: 2 })).toBe(true); // corner
    expect(rectsOverlap(base, { x: 3, y: 3, width: 1, height: 1 })).toBe(true); // nested
    expect(rectsOverlap(base, { ...base })).toBe(true); // identical
    expect(rectsOverlap(base, { x: 10, y: 10, width: 2, height: 2 })).toBe(false); // far away
  });
});

describe('Floor plan builder', () => {
  let organizer;
  let expo;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
  });

  it('lays out 20 booths on a grid with none overlapping', async () => {
    // 20 booths of 2x2 across a 20x14 grid: 5 columns x 4 rows.
    const booths = [];
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        booths.push(booth(`A${row * 5 + col + 1}`, col * 4, row * 3, 2, 2));
      }
    }

    const res = await as(organizer).put(`/api/booths/expo/${expo._id}/layout`).send({ booths });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(20);
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(20);

    // assert the saved plan really is collision-free.
    const saved = await Booth.find({ expoRef: expo._id }).lean();
    for (let i = 0; i < saved.length; i += 1) {
      for (let j = i + 1; j < saved.length; j += 1) {
        expect(rectsOverlap(saved[i], saved[j])).toBe(false);
      }
    }
  });

  it('rejects a bulk layout containing an overlap, naming both booths', async () => {
    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0, 3, 3), booth('A2', 2, 2, 3, 3)] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/A1.*overlaps.*A2|A2.*overlaps.*A1/);
    // nothing may be written when the layout is rejected.
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(0);
  });

  it('rejects duplicate labels in a layout', async () => {
    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A1', 5, 5)] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/labelled "A1"/i);
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(0);
  });

  it('rejects a booth that falls outside the grid', async () => {
    // the default grid is 20x14.
    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 19, 0, 4, 2)] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/outside the 20×14 floor plan/i);
  });

  it('blocks a single booth that would overlap an existing one', async () => {
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0, 3, 3) });

    const res = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), ...booth('A2', 1, 1, 3, 3) });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/overlaps booth "A1"/);
    // the conflicting booth is named so the UI can highlight it inline.
    expect(res.body.errors[0].conflictingBoothLabel).toBe('A1');
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(1);
  });

  it('blocks dragging a booth on top of another', async () => {
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0, 2, 2) });
    const second = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), ...booth('A2', 6, 6, 2, 2) });

    const moved = await as(organizer).patch(`/api/booths/${second.body.data.booth.id}`).send({ x: 1, y: 1 });

    expect(moved.status).toBe(409);
    expect(moved.body.message).toMatch(/overlaps booth "A1"/);

    // the rejected move must not have been applied.
    const unchanged = await Booth.findById(second.body.data.booth.id);
    expect(unchanged.x).toBe(6);
    expect(unchanged.y).toBe(6);
  });

  it('lets a booth move onto its own footprint without self-collision', async () => {
    const created = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), ...booth('A1', 4, 4, 2, 2) });

    const res = await as(organizer).patch(`/api/booths/${created.body.data.booth.id}`).send({ width: 3, height: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.booth.width).toBe(3);
  });

  it('rejects a duplicate booth label in the same expo', async () => {
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0) });
    const res = await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 8, 8) });

    expect(res.status).toBe(409);
  });

  it('stops an organizer editing another organizer\'s floor plan', async () => {
    const other = await makeUser('organizer');
    const res = await as(other)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0)] });

    expect(res.status).toBe(403);
  });

  it('refuses layout edits from exhibitors and attendees', async () => {
    for (const role of ['exhibitor', 'attendee']) {
      const actor = await makeUser(role);
      const res = await as(actor).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0) });
      expect(res.status).toBe(403);
    }
  });

  it('swaps two booth labels in one save', async () => {
    // the unique {expoRef, label} index is checked per write, so a naive
    // ordering collides part-way through even though the final state is valid.
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0)] });

    const [a1, a2] = first.body.data.items;

    const swapped = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({
        booths: [
          { id: a1.id, ...booth('A2', 0, 0) },
          { id: a2.id, ...booth('A1', 4, 0) },
        ],
      });

    expect(swapped.status).toBe(200);

    const byId = new Map(swapped.body.data.items.map((b) => [b.id, b.label]));
    expect(byId.get(a1.id)).toBe('A2');
    expect(byId.get(a2.id)).toBe('A1');
  });

  it('reuses the label of a booth deleted in the same save', async () => {
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0)] });

    const [a1] = first.body.data.items;

    // drop A2, then add a brand-new booth that takes its label.
    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [{ id: a1.id, ...booth('A1', 0, 0) }, booth('A2', 8, 0)] });

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((b) => b.label).sort()).toEqual(['A1', 'A2']);
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(2);
  });

  it('leaves no parked placeholder labels behind', async () => {
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0), booth('A3', 8, 0)] });

    const [a1, a2, a3] = first.body.data.items;

    // rotate all three labels at once.
    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({
        booths: [
          { id: a1.id, ...booth('A2', 0, 0) },
          { id: a2.id, ...booth('A3', 4, 0) },
          { id: a3.id, ...booth('A1', 8, 0) },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items.map((b) => b.label).sort()).toEqual(['A1', 'A2', 'A3']);
    // the temporary labels used mid-save must never survive.
    const parked = await Booth.find({ expoRef: expo._id, label: /^~/ });
    expect(parked).toHaveLength(0);
  });

  it('keeps a renamed booth when a new booth reuses its old label', async () => {
    // resolving an id-less booth by label must not hijack a booth that is
    // being renamed in the same save — that silently deleted one of them.
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0)] });

    const a1 = first.body.data.items.find((b) => b.label === 'A1');
    const a2 = first.body.data.items.find((b) => b.label === 'A2');

    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({
        booths: [
          { id: a1.id, ...booth('B1', 0, 0) },  // renamed
          { id: a2.id, ...booth('A2', 4, 0) },
          booth('A1', 8, 0),                     // brand-new, reusing the freed label
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.items.map((b) => b.label).sort()).toEqual(['A1', 'A2', 'B1']);
    // the renamed booth kept its identity rather than being consumed.
    expect(res.body.data.items.find((b) => b.label === 'B1').id).toBe(a1.id);
  });

  it('adopts an id-less booth whose label already exists, instead of failing', async () => {
    // the builder can hold unsaved work while a socket refresh lands, so its
    // "new" booth is really one that already exists.
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0)] });

    const a1 = first.body.data.items.find((b) => b.label === 'A1');

    const res = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0), booth('A3', 8, 0)] });

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(3);
    // A1 was adopted, not duplicated.
    expect(res.body.data.items.find((b) => b.label === 'A1').id).toBe(a1.id);
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(3);
  });

  it('names the clashing booth when a duplicate label reaches the database', async () => {
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0) });
    const res = await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 8, 8) });

    expect(res.status).toBe(409);
    // not the useless generic "That value is already in use."
    expect(res.body.message).toMatch(/"A1" is already taken/);
    expect(res.body.errors[0].field).toBe('label');
  });

  it('updates and deletes booths through a bulk save', async () => {
    const first = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [booth('A1', 0, 0), booth('A2', 4, 0)] });

    const [a1] = first.body.data.items;

    // keep A1 (moved), drop A2, add A3.
    const second = await as(organizer)
      .put(`/api/booths/expo/${expo._id}/layout`)
      .send({ booths: [{ id: a1.id, ...booth('A1', 8, 8) }, booth('A3', 0, 0)] });

    expect(second.status).toBe(200);
    const labels = second.body.data.items.map((b) => b.label).sort();
    expect(labels).toEqual(['A1', 'A3']);

    const moved = await Booth.findById(a1.id);
    expect(moved.x).toBe(8);
  });
});

describe('Booth reservation', () => {
  let organizer;
  let expo;
  let boothId;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    const res = await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0) });
    boothId = res.body.data.booth.id;
  });

  it('lets an approved exhibitor reserve an available booth', async () => {
    const exhibitor = await makeApprovedExhibitor(expo);

    const res = await as(exhibitor).patch(`/api/booths/${boothId}/reserve`);

    expect(res.status).toBe(200);
    expect(res.body.data.booth.status).toBe('reserved');
    expect(String(res.body.data.booth.exhibitorRef.id ?? res.body.data.booth.exhibitorRef)).toBe(
      String(exhibitor.profile._id)
    );
  });

  it('refuses reservation while an application is still pending', async () => {
    const exhibitor = await makeApprovedExhibitor(expo, { approvalStatus: 'pending' });

    const res = await as(exhibitor).patch(`/api/booths/${boothId}/reserve`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/still being reviewed/i);
    expect((await Booth.findById(boothId)).status).toBe('available');
  });

  it('refuses reservation from an exhibitor who never applied', async () => {
    const stranger = await makeUser('exhibitor');
    const res = await as(stranger).patch(`/api/booths/${boothId}/reserve`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/apply to this expo/i);
  });

  it('does not let two exhibitors reserve the same booth at once', async () => {
    const [first, second, third] = await Promise.all([
      makeApprovedExhibitor(expo, { companyName: 'One' }),
      makeApprovedExhibitor(expo, { companyName: 'Two' }),
      makeApprovedExhibitor(expo, { companyName: 'Three' }),
    ]);

    const results = await Promise.all(
      [first, second, third].map((e) => as(e).patch(`/api/booths/${boothId}/reserve`))
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect((await Booth.findById(boothId)).status).toBe('reserved');
  });

  it('stops one exhibitor holding two booths', async () => {
    const second = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), ...booth('A2', 6, 6) });

    const exhibitor = await makeApprovedExhibitor(expo);
    expect((await as(exhibitor).patch(`/api/booths/${boothId}/reserve`)).status).toBe(200);

    const res = await as(exhibitor).patch(`/api/booths/${second.body.data.booth.id}/reserve`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already hold booth "A1"/i);
  });

  it('frees the booth on release so someone else can take it', async () => {
    const first = await makeApprovedExhibitor(expo, { companyName: 'One' });
    const second = await makeApprovedExhibitor(expo, { companyName: 'Two' });

    await as(first).patch(`/api/booths/${boothId}/reserve`);
    expect((await as(second).patch(`/api/booths/${boothId}/reserve`)).status).toBe(409);

    const released = await as(first).patch(`/api/booths/${boothId}/release`);
    expect(released.status).toBe(200);
    expect((await Booth.findById(boothId)).status).toBe('available');

    expect((await as(second).patch(`/api/booths/${boothId}/reserve`)).status).toBe(200);
  });

  it("stops an exhibitor releasing someone else's booth", async () => {
    const holder = await makeApprovedExhibitor(expo, { companyName: 'Holder' });
    const other = await makeApprovedExhibitor(expo, { companyName: 'Other' });

    await as(holder).patch(`/api/booths/${boothId}/reserve`);

    const res = await as(other).patch(`/api/booths/${boothId}/release`);
    expect(res.status).toBe(403);
    expect((await Booth.findById(boothId)).status).toBe('reserved');
  });

  it('lets the organizer assign and reassign a booth', async () => {
    const exhibitor = await makeApprovedExhibitor(expo);

    const assigned = await as(organizer)
      .patch(`/api/booths/${boothId}/assign`)
      .send({ exhibitorRef: String(exhibitor.profile._id) });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data.booth.status).toBe('assigned');

    // reassigning to a second booth frees the first.
    const second = await as(organizer)
      .post('/api/booths')
      .send({ expoRef: String(expo._id), ...booth('A2', 6, 6) });

    await as(organizer)
      .patch(`/api/booths/${second.body.data.booth.id}/assign`)
      .send({ exhibitorRef: String(exhibitor.profile._id) });

    expect((await Booth.findById(boothId)).status).toBe('available');
  });

  it('refuses to assign a booth to an unapproved exhibitor', async () => {
    const pending = await makeApprovedExhibitor(expo, { approvalStatus: 'pending' });

    const res = await as(organizer)
      .patch(`/api/booths/${boothId}/assign`)
      .send({ exhibitorRef: String(pending.profile._id) });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/approve the exhibitor/i);
  });

  it('refuses to delete a booth that is taken', async () => {
    const exhibitor = await makeApprovedExhibitor(expo);
    await as(exhibitor).patch(`/api/booths/${boothId}/reserve`);

    const res = await as(organizer).delete(`/api/booths/${boothId}`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/release it before deleting/i);
    expect(await Booth.findById(boothId)).not.toBeNull();
  });

  it('refuses to drag a taken booth off the canvas via a bulk save', async () => {
    const exhibitor = await makeApprovedExhibitor(expo);
    await as(exhibitor).patch(`/api/booths/${boothId}/reserve`);

    const res = await as(organizer).put(`/api/booths/expo/${expo._id}/layout`).send({ booths: [] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/cannot be removed/i);
    expect(await Booth.countDocuments({ expoRef: expo._id })).toBe(1);
  });
});

describe('Floor plan visibility', () => {
  it('serves the plan publicly for a published expo', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    await as(organizer).post('/api/booths').send({ expoRef: String(expo._id), ...booth('A1', 0, 0) });

    const res = await request(app).get(`/api/booths/expo/${expo._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    // the viewer needs the grid to render the plan at the right proportions.
    expect(res.body.data.expo.floorPlanConfig).toEqual({ gridWidth: 20, gridHeight: 14 });
  });

  it("hides a draft expo's plan from everyone but its organizer", async () => {
    const organizer = await makeUser('organizer');
    const draft = await makeExpo(organizer, { status: 'draft' });

    expect((await request(app).get(`/api/booths/expo/${draft._id}`)).status).toBe(404);
    expect((await as(organizer).get(`/api/booths/expo/${draft._id}`)).status).toBe(200);
  });

  it('tells an exhibitor which profile is theirs on this expo', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const exhibitor = await makeApprovedExhibitor(expo);

    const res = await as(exhibitor).get(`/api/booths/expo/${expo._id}`);

    expect(res.body.data.myProfile).toMatchObject({
      id: String(exhibitor.profile._id),
      approvalStatus: 'approved',
    });
  });
});
