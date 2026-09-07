const db = require('../setup/testDb');

// cloudinary and SMTP are stubbed — these tests exercise our own pipeline
// (validation, ownership, state transitions), not a third party's uptime.
jest.mock('../../src/services/uploadService', () => ({
  uploadLogo: jest.fn(async (file) => ({
    url: `https://res.cloudinary.test/logos/${file.originalname}`,
    publicId: `eventsphere/logos/${file.originalname}`,
    filename: file.originalname,
    mimeType: file.mimetype,
    bytes: file.size,
    resourceType: 'image',
  })),
  uploadDocument: jest.fn(async (file) => ({
    url: `https://res.cloudinary.test/documents/${file.originalname}`,
    publicId: `eventsphere/documents/${file.originalname}`,
    filename: file.originalname,
    mimeType: file.mimetype,
    bytes: file.size,
    resourceType: file.mimetype.startsWith('image/') ? 'image' : 'raw',
  })),
  destroyAsset: jest.fn(async () => undefined),
  isCloudinaryConfigured: () => true,
}));

jest.mock('../../src/services/emailService', () => ({
  sendExhibitorDecisionEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendPasswordResetEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendPasswordChangedEmail: jest.fn(async () => ({ messageId: 'test' })),
  sendMail: jest.fn(async () => ({ messageId: 'test' })),
  baseTemplate: () => '',
}));

const { makeUser, makeExpo, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const uploadService = require('../../src/services/uploadService');
const emailService = require('../../src/services/emailService');

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.disconnect);

// a one-pixel PNG — real bytes with a real magic number, kept tiny.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/** builds the multipart application request the exhibitor form submits. */
function applyRequest(actor, expo) {
  return as(actor)
    .post('/api/exhibitors')
    .field('expoRef', String(expo._id))
    .field('companyName', 'Helix Robotics')
    .field('description', 'We build collaborative warehouse robots for small and mid-size logistics operators.')
    .field('category', 'Robotics')
    .field('contact', JSON.stringify({ email: 'hello@helix.test', phone: '+92 300 1234567', website: 'https://helix.test' }))
    .field('products', JSON.stringify([{ name: 'Helix One', category: 'Robotics', description: 'A picking arm.' }]))
    .field('staff', JSON.stringify([{ name: 'Sana Iqbal', role: 'Head of Sales', email: 'sana@helix.test' }]));
}

describe('Exhibitor application flow', () => {
  let organizer;
  let expo;
  let exhibitor;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    exhibitor = await makeUser('exhibitor');
  });

  it('accepts an application with a logo and a document', async () => {
    const res = await applyRequest(exhibitor, expo)
      .attach('logo', PNG, 'helix-logo.png')
      .attach('documents', PDF, 'company-profile.pdf');

    expect(res.status).toBe(201);

    const { profile } = res.body.data;
    expect(profile.companyName).toBe('Helix Robotics');
    expect(profile.approvalStatus).toBe('pending');
    expect(profile.logoUrl).toContain('helix-logo.png');
    expect(profile.documents).toHaveLength(1);
    expect(profile.documents[0].filename).toBe('company-profile.pdf');
    // the multipart JSON fields survived the round trip.
    expect(profile.products[0].name).toBe('Helix One');
    expect(profile.staff[0].name).toBe('Sana Iqbal');
    expect(profile.contact.email).toBe('hello@helix.test');

    expect(uploadService.uploadLogo).toHaveBeenCalledTimes(1);
    expect(uploadService.uploadDocument).toHaveBeenCalledTimes(1);
    // the private Cloudinary handle must never reach the client.
    expect(profile.logoPublicId).toBeUndefined();
  });

  it('accepts an application with no attachments at all', async () => {
    const res = await applyRequest(exhibitor, expo);
    expect(res.status).toBe(201);
    expect(res.body.data.profile.logoUrl).toBeNull();
    expect(res.body.data.profile.documents).toHaveLength(0);
  });

  it('rejects a wrong file type with a clear message and stores nothing', async () => {
    const res = await applyRequest(exhibitor, expo).attach(
      'documents',
      Buffer.from('#!/bin/sh\necho hi\n'),
      'payload.sh'
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not an accepted document type/i);
    expect(res.body.message).toMatch(/PDF/);
    expect(uploadService.uploadDocument).not.toHaveBeenCalled();
    expect(await ExhibitorProfile.countDocuments()).toBe(0);
  });

  it('rejects a file whose extension disagrees with its declared type', async () => {
    const res = await applyRequest(exhibitor, expo).attach('documents', PDF, {
      filename: 'sneaky.exe',
      contentType: 'application/pdf',
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
    expect(await ExhibitorProfile.countDocuments()).toBe(0);
  });

  it('rejects an oversized upload with the limit named in the message', async () => {
    // 6MB — over the 5MB document ceiling.
    const oversized = Buffer.alloc(6 * 1024 * 1024, 0);

    const res = await applyRequest(exhibitor, expo).attach('documents', oversized, 'huge.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/i);
    expect(res.body.message).toMatch(/5MB/);
    expect(uploadService.uploadDocument).not.toHaveBeenCalled();
    expect(await ExhibitorProfile.countDocuments()).toBe(0);
  });

  it('rejects an oversized logo against the tighter 2MB image limit', async () => {
    const oversized = Buffer.alloc(3 * 1024 * 1024, 0);
    const res = await applyRequest(exhibitor, expo).attach('logo', oversized, 'huge-logo.png');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/too large/i);
    expect(res.body.message).toMatch(/2MB/);
  });

  it('rejects more documents than the limit allows', async () => {
    let req = applyRequest(exhibitor, expo);
    for (let i = 0; i < 6; i += 1) req = req.attach('documents', PDF, `doc-${i}.pdf`);

    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 5 documents/i);
  });

  it('rejects an application missing required company details', async () => {
    const res = await as(exhibitor)
      .post('/api/exhibitors')
      .field('expoRef', String(expo._id))
      .field('companyName', 'X')
      .field('description', 'short')
      .field('category', 'R');

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['companyName', 'description'])
    );
  });

  it('allows only one application per exhibitor per expo', async () => {
    expect((await applyRequest(exhibitor, expo)).status).toBe(201);

    const duplicate = await applyRequest(exhibitor, expo);
    expect(duplicate.status).toBe(409);
    expect(await ExhibitorProfile.countDocuments()).toBe(1);
  });

  it('refuses applications to an unpublished expo', async () => {
    const draft = await makeExpo(organizer, { status: 'draft' });
    const res = await applyRequest(exhibitor, draft);
    expect(res.status).toBe(400);
  });

  it('refuses applications from non-exhibitor roles', async () => {
    const attendee = await makeUser('attendee');
    expect((await applyRequest(attendee, expo)).status).toBe(403);
  });
});

describe('Organizer review queue', () => {
  let organizer;
  let expo;
  let exhibitor;
  let profileId;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    exhibitor = await makeUser('exhibitor');
    const res = await applyRequest(exhibitor, expo);
    profileId = res.body.data.profile.id;
  });

  it('lists pending applications with status tallies', async () => {
    const res = await as(organizer).get(`/api/exhibitors?expoRef=${expo._id}&approvalStatus=pending`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.counts).toMatchObject({ pending: 1, approved: 0, rejected: 0 });
  });

  it('approves an application, updates the exhibitor\'s status and emails them', async () => {
    const res = await as(organizer)
      .patch(`/api/exhibitors/${profileId}/status`)
      .send({ approvalStatus: 'approved', reviewNote: 'Great fit for the robotics hall.' });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.approvalStatus).toBe('approved');
    expect(String(res.body.data.profile.reviewedBy)).toBe(organizer.id);
    expect(res.body.data.profile.reviewedAt).not.toBeNull();

    // the exhibitor sees the new status on their own application.
    const mine = await as(exhibitor).get('/api/exhibitors/me');
    expect(mine.body.data.items[0].approvalStatus).toBe('approved');

    expect(emailService.sendExhibitorDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ approved: true, companyName: 'Helix Robotics' })
    );
  });

  it('rejects an application with a reason', async () => {
    const res = await as(organizer)
      .patch(`/api/exhibitors/${profileId}/status`)
      .send({ approvalStatus: 'rejected', reviewNote: 'The robotics hall is fully booked this year.' });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.approvalStatus).toBe('rejected');
    expect(emailService.sendExhibitorDecisionEmail).toHaveBeenCalledWith(
      expect.objectContaining({ approved: false })
    );
  });

  it('requires a reason when rejecting', async () => {
    const res = await as(organizer).patch(`/api/exhibitors/${profileId}/status`).send({ approvalStatus: 'rejected' });

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'reviewNote')).toBe(true);
    expect((await ExhibitorProfile.findById(profileId)).approvalStatus).toBe('pending');
  });

  it('stops an organizer reviewing an application on someone else\'s expo', async () => {
    const other = await makeUser('organizer');
    const res = await as(other)
      .patch(`/api/exhibitors/${profileId}/status`)
      .send({ approvalStatus: 'approved', reviewNote: 'Not mine to approve.' });

    expect(res.status).toBe(403);
  });

  it('never shows another organizer\'s applications', async () => {
    const other = await makeUser('organizer');
    const res = await as(other).get('/api/exhibitors');

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('keeps pending applications out of the public directory', async () => {
    const anonymous = await request(app).get(`/api/exhibitors?expoRef=${expo._id}`);
    expect(anonymous.body.data.items).toHaveLength(0);

    // 404 rather than 403 — a stranger should not learn the record exists.
    expect((await request(app).get(`/api/exhibitors/${profileId}`)).status).toBe(404);

    await as(organizer)
      .patch(`/api/exhibitors/${profileId}/status`)
      .send({ approvalStatus: 'approved', reviewNote: 'Approved.' });

    const afterApproval = await request(app).get(`/api/exhibitors?expoRef=${expo._id}`);
    expect(afterApproval.body.data.items).toHaveLength(1);
    expect((await request(app).get(`/api/exhibitors/${profileId}`)).status).toBe(200);
  });
});

describe('Exhibitor profile management', () => {
  let organizer;
  let expo;
  let exhibitor;
  let profileId;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    exhibitor = await makeUser('exhibitor');
    profileId = (await applyRequest(exhibitor, expo)).body.data.profile.id;
  });

  it('updates company details, products and staff', async () => {
    const res = await as(exhibitor)
      .patch(`/api/exhibitors/${profileId}`)
      .send({
        companyName: 'Helix Robotics International',
        products: [{ name: 'Helix Two', category: 'Robotics', description: 'A faster arm.' }],
        staff: [{ name: 'Bilal Ahmed', role: 'CTO', email: '' }],
        contact: { phone: '+92 21 5555555' },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.companyName).toBe('Helix Robotics International');
    expect(res.body.data.profile.products).toHaveLength(1);
    expect(res.body.data.profile.products[0].name).toBe('Helix Two');
    // a partial contact patch must not wipe the fields it left out.
    expect(res.body.data.profile.contact.email).toBe('hello@helix.test');
    expect(res.body.data.profile.contact.phone).toBe('+92 21 5555555');
  });

  it('stops one exhibitor editing another\'s profile', async () => {
    const other = await makeUser('exhibitor');
    const res = await as(other).patch(`/api/exhibitors/${profileId}`).send({ companyName: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('replaces the logo and deletes the file it superseded', async () => {
    await as(exhibitor).post(`/api/exhibitors/${profileId}/logo`).attach('logo', PNG, 'first.png');
    const res = await as(exhibitor).post(`/api/exhibitors/${profileId}/logo`).attach('logo', PNG, 'second.png');

    expect(res.status).toBe(200);
    expect(res.body.data.logoUrl).toContain('second.png');
    expect(uploadService.destroyAsset).toHaveBeenCalledWith('eventsphere/logos/first.png', 'image');
  });

  it('rejects a non-image logo', async () => {
    const res = await as(exhibitor).post(`/api/exhibitors/${profileId}/logo`).attach('logo', PDF, 'not-an-image.pdf');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not an accepted logo type/i);
  });

  it('adds and removes documents, cleaning up storage on removal', async () => {
    const added = await as(exhibitor)
      .post(`/api/exhibitors/${profileId}/documents`)
      .attach('documents', PDF, 'brochure.pdf');

    expect(added.status).toBe(201);
    expect(added.body.data.documents).toHaveLength(1);

    const documentId = added.body.data.documents[0]._id ?? added.body.data.documents[0].id;
    const removed = await as(exhibitor).delete(`/api/exhibitors/${profileId}/documents/${documentId}`);

    expect(removed.status).toBe(200);
    expect(removed.body.data.documents).toHaveLength(0);
    expect(uploadService.destroyAsset).toHaveBeenCalledWith('eventsphere/documents/brochure.pdf', 'raw');
  });

  it('refuses to exceed the document limit across separate uploads', async () => {
    let req = as(exhibitor).post(`/api/exhibitors/${profileId}/documents`);
    for (let i = 0; i < 5; i += 1) req = req.attach('documents', PDF, `doc-${i}.pdf`);
    expect((await req).status).toBe(201);

    const overflow = await as(exhibitor)
      .post(`/api/exhibitors/${profileId}/documents`)
      .attach('documents', PDF, 'one-too-many.pdf');

    expect(overflow.status).toBe(400);
    expect(overflow.body.message).toMatch(/limit is 5/i);
  });
});
