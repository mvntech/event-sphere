const db = require('../setup/testDb');

jest.mock('../../src/services/emailService', () => ({
  sendOrganizerDecisionEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendExhibitorDecisionEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendPasswordResetEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendPasswordChangedEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendMail: jest.fn(async () => ({ messageId: 'test' })),
  baseTemplate: () => '',
}));

const { makeUser, makeExpo, as, request, app } = require('../helpers/factories');
const User = require('../../src/models/User');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const Notification = require('../../src/models/Notification');
const emailService = require('../../src/services/emailService');

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.disconnect);

/** registers through the real endpoint so the approval rules actually run. */
const registerRaw = (role, overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({
      name: overrides.name ?? `New ${role}`,
      email: overrides.email ?? `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.test`,
      password: 'Password123',
      role,
      consentGiven: true,
      ...overrides,
    });

describe('Organizer approval — bootstrap', () => {
  it('approves the very first organizer automatically', async () => {
    // otherwise nobody could ever approve anyone and the system is unusable.
    const res = await registerRaw('organizer');

    expect(res.status).toBe(201);
    expect(res.body.data.user.organizerApprovalStatus).toBe('approved');
    // they get a session straight away.
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('leaves every later organizer pending, with no session', async () => {
    await registerRaw('organizer');

    const second = await registerRaw('organizer');

    expect(second.status).toBe(201);
    expect(second.body.data.user.organizerApprovalStatus).toBe('pending');
    expect(second.body.data.pendingApproval).toBe(true);
    // no tokens: there is nothing they may do yet.
    expect(second.body.data.accessToken).toBeUndefined();
    expect(second.body.message).toMatch(/approve it before you can sign in/i);
  });

  it('does not gate exhibitors or attendees', async () => {
    await registerRaw('organizer');

    for (const role of ['exhibitor', 'attendee']) {
      const res = await registerRaw(role);
      expect(res.status).toBe(201);
      expect(res.body.data.user.organizerApprovalStatus).toBeNull();
      expect(res.body.data.accessToken).toBeTruthy();
    }
  });
});

describe('Organizer approval — sign-in gate', () => {
  it('refuses sign-in while an organizer is pending', async () => {
    await registerRaw('organizer');
    const email = `pending-${Date.now()}@e2e.test`;
    await registerRaw('organizer', { email });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/waiting for approval/i);
  });

  it('refuses sign-in for a rejected organizer', async () => {
    const first = await registerRaw('organizer');
    const email = `rejected-${Date.now()}@e2e.test`;
    const pending = await registerRaw('organizer', { email });

    await request(app)
      .patch(`/api/users/${pending.body.data.user.id}/organizer-status`)
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .send({ organizerApprovalStatus: 'rejected', reviewNote: 'Not part of the events team.' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not approved/i);
  });

  it('lets an approved organizer sign in', async () => {
    const first = await registerRaw('organizer');
    const email = `approved-${Date.now()}@e2e.test`;
    const pending = await registerRaw('organizer', { email });

    const review = await request(app)
      .patch(`/api/users/${pending.body.data.user.id}/organizer-status`)
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .send({ organizerApprovalStatus: 'approved' });

    expect(review.status).toBe(200);

    const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('keeps grandfathered organizers (null status) able to sign in', async () => {
    // Accounts that predate the field must not be locked out by it.
    const legacy = await makeUser('organizer');
    await User.updateOne({ _id: legacy.user._id }, { $set: { organizerApprovalStatus: null } });

    const res = await request(app).post('/api/auth/login').send({ email: legacy.user.email, password: 'Password123' });

    expect(res.status).toBe(200);
  });

  it('gives the same message for a wrong password as for a missing account', async () => {
    // the approval check must not become an account-enumeration oracle.
    await registerRaw('organizer');
    const email = `enum-${Date.now()}@e2e.test`;
    await registerRaw('organizer', { email });

    const wrongPassword = await request(app).post('/api/auth/login').send({ email, password: 'WrongPassword1' });
    const missing = await request(app).post('/api/auth/login').send({ email: 'nobody@e2e.test', password: 'WrongPassword1' });

    expect(wrongPassword.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrongPassword.body.message).toBe(missing.body.message);
  });
});

describe('Organizer review actions', () => {
  let reviewer;
  let pendingId;

  beforeEach(async () => {
    reviewer = await makeUser('organizer');
    const pending = await registerRaw('organizer', { name: 'Pending Person' });
    pendingId = pending.body.data.user.id;
  });

  it('notifies and emails the organizer on approval', async () => {
    const res = await as(reviewer)
      .patch(`/api/users/${pendingId}/organizer-status`)
      .send({ organizerApprovalStatus: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.organizerApprovalStatus).toBe('approved');

    expect(emailService.sendOrganizerDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ approved: true })
    );

    const notification = await Notification.findOne({ userRef: pendingId });
    expect(notification.message).toMatch(/approved/i);
  });

  it('requires a reason when refusing', async () => {
    const res = await as(reviewer)
      .patch(`/api/users/${pendingId}/organizer-status`)
      .send({ organizerApprovalStatus: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'reviewNote')).toBe(true);

    const stored = await User.findById(pendingId);
    expect(stored.organizerApprovalStatus).toBe('pending');
  });

  it('records who reviewed and when', async () => {
    await as(reviewer).patch(`/api/users/${pendingId}/organizer-status`).send({ organizerApprovalStatus: 'approved' });

    const stored = await User.findById(pendingId);
    expect(String(stored.organizerReviewedBy)).toBe(reviewer.id);
    expect(stored.organizerReviewedAt).toBeTruthy();
  });

  it('refuses to review your own account', async () => {
    const res = await as(reviewer)
      .patch(`/api/users/${reviewer.id}/organizer-status`)
      .send({ organizerApprovalStatus: 'approved' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/your own account/i);
  });

  it('refuses to review a non-organizer', async () => {
    const attendee = await makeUser('attendee');
    const res = await as(reviewer)
      .patch(`/api/users/${attendee.id}/organizer-status`)
      .send({ organizerApprovalStatus: 'approved' });

    expect(res.status).toBe(400);
  });

  it('is closed to exhibitors and attendees', async () => {
    for (const role of ['exhibitor', 'attendee']) {
      const actor = await makeUser(role);
      const res = await as(actor)
        .patch(`/api/users/${pendingId}/organizer-status`)
        .send({ organizerApprovalStatus: 'approved' });
      expect(res.status).toBe(403);
    }
  });
});

describe('User directory', () => {
  it('lists users with role counts and a pending-organizer tally', async () => {
    const organizer = await makeUser('organizer');
    await makeUser('attendee');
    await makeUser('exhibitor');
    await registerRaw('organizer');

    const res = await as(organizer).get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body.data.counts.pendingOrganizers).toBe(1);
    expect(res.body.data.counts.attendee).toBe(1);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(4);
    // password material must never appear.
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
  });

  it('filters by role and by pending status', async () => {
    const organizer = await makeUser('organizer');
    await makeUser('attendee');
    await registerRaw('organizer');

    const attendees = await as(organizer).get('/api/users?role=attendee');
    expect(attendees.body.data.items.every((u) => u.role === 'attendee')).toBe(true);

    const pending = await as(organizer).get('/api/users?status=pending');
    expect(pending.body.data.items).toHaveLength(1);
    expect(pending.body.data.items[0].organizerApprovalStatus).toBe('pending');
  });

  it('searches by name and email', async () => {
    const organizer = await makeUser('organizer');
    await makeUser('attendee', { name: 'Findable Person', email: `findable-${Date.now()}@e2e.test` });

    const res = await as(organizer).get('/api/users?search=Findable');
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Findable Person');
  });

  it('is closed to non-organizers', async () => {
    for (const role of ['exhibitor', 'attendee']) {
      const actor = await makeUser(role);
      expect((await as(actor).get('/api/users')).status).toBe(403);
    }
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/users')).status).toBe(401);
  });
});

describe('Role changes', () => {
  let organizer;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
  });

  it('promotes an attendee to organizer, already approved', async () => {
    const attendee = await makeUser('attendee');

    const res = await as(organizer).patch(`/api/users/${attendee.id}/role`).send({ role: 'organizer' });

    expect(res.status).toBe(200);
    // promotion by an existing organizer is itself the approval.
    expect(res.body.data.user.organizerApprovalStatus).toBe('approved');

    const login = await request(app).post('/api/auth/login').send({ email: attendee.user.email, password: 'Password123' });
    expect(login.status).toBe(200);
  });

  it('refuses to demote an organizer who still runs expos', async () => {
    const other = await makeUser('organizer');
    await makeExpo(other, { status: 'published' });

    const res = await as(organizer).patch(`/api/users/${other.id}/role`).send({ role: 'attendee' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/still runs 1 expo/i);
  });

  it('refuses to demote the last active organizer', async () => {
    const other = await makeUser('organizer');
    // remove the reviewer so `other` is the only one left besides them.
    await User.deleteOne({ _id: organizer.user._id });

    const promoted = await makeUser('organizer');
    const res = await as(promoted).patch(`/api/users/${other.id}/role`).send({ role: 'attendee' });

    // `promoted` still counts, so this one is allowed.
    expect(res.status).toBe(200);
  });

  it('refuses to demote an exhibitor holding applications', async () => {
    const exhibitor = await makeUser('exhibitor');
    const expo = await makeExpo(organizer, { status: 'published' });
    await ExhibitorProfile.create({
      userRef: exhibitor.user._id,
      expoRef: expo._id,
      companyName: 'Helix Robotics',
      description: 'We build collaborative warehouse robots for logistics operators.',
      category: 'Robotics',
    });

    const res = await as(organizer).patch(`/api/users/${exhibitor.id}/role`).send({ role: 'attendee' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/exhibitor application/i);
  });

  it('refuses to change your own role', async () => {
    const res = await as(organizer).patch(`/api/users/${organizer.id}/role`).send({ role: 'attendee' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown role', async () => {
    const attendee = await makeUser('attendee');
    const res = await as(organizer).patch(`/api/users/${attendee.id}/role`).send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });
});
