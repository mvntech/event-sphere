/**
 * seeds the fixture the end-to-end suite drives.
 *
 * lives under `backend/` rather than `e2e/` on purpose: it talks to the real
 * mongoose models, and those resolve their own dependencies relative to the
 * backend package. running it from anywhere else would mean either a second
 * copy of mongoose or a pile of path gymnastics.
 *
 *   node tests/e2e/seedE2e.js            seed (clears the e2e database first)
 *   node tests/e2e/seedE2e.js --print    seed, then print the fixture as JSON
 *
 * MONGODB_URI must already point at the e2e database; the guard below refuses
 * to touch anything whose name does not end in `_test`.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const env = require('../../src/config/env');
const User = require('../../src/models/User');
const Expo = require('../../src/models/Expo');
const Booth = require('../../src/models/Booth');
const Session = require('../../src/models/Session');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');

/** one password for every fixture account. nothing here is ever exposed. */
const PASSWORD = 'E2ePassw0rd!';

const DAY = 24 * 60 * 60 * 1000;

const ACCOUNTS = {
  organizer: 'e2e.organizer@eventsphere.test',
  pendingOrganizer: 'e2e.pending@eventsphere.test',
  exhibitorA: 'e2e.exhibitor.a@eventsphere.test',
  exhibitorB: 'e2e.exhibitor.b@eventsphere.test',
  attendee: 'e2e.attendee@eventsphere.test',
  // a second attendee: capacity can only be tested by a different person
  // competing for the same seat, and registration is attendee-only.
  attendeeB: 'e2e.attendee.b@eventsphere.test',
};

async function connect() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });

  // the same guard the Jest suite uses. a misconfigured URI must never be able
  // to clear a real database.
  if (!mongoose.connection.name.endsWith('_test')) {
    await mongoose.disconnect();
    throw new Error(
      `Refusing to seed database "${mongoose.connection.name}" — it is not a _test database.`
    );
  }

  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

async function seed() {
  await connect();

  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const base = { passwordHash, consentGiven: true };

  const [organizer, pendingOrganizer, exhibitorA, exhibitorB, attendee, attendeeB] = await User.create([
    { ...base, name: 'Ada Reyes', email: ACCOUNTS.organizer, role: 'organizer', organizerApprovalStatus: 'approved' },
    { ...base, name: 'Ines Toft', email: ACCOUNTS.pendingOrganizer, role: 'organizer', organizerApprovalStatus: 'pending' },
    { ...base, name: 'Dan Okafor', email: ACCOUNTS.exhibitorA, role: 'exhibitor' },
    { ...base, name: 'Mei Lin', email: ACCOUNTS.exhibitorB, role: 'exhibitor' },
    { ...base, name: 'Sam Iqbal', email: ACCOUNTS.attendee, role: 'attendee' },
    { ...base, name: 'Ruth Vance', email: ACCOUNTS.attendeeB, role: 'attendee' },
  ]);

  const now = Date.now();
  const expo = await Expo.create({
    organizerRef: organizer._id,
    title: 'Meridian Test Expo',
    description: 'The fixture expo the end-to-end suite drives.',
    theme: 'Instrumentation',
    location: 'Hall 3, Meridian Centre',
    startDate: new Date(now + 7 * DAY),
    endDate: new Date(now + 9 * DAY),
    status: 'published',
    floorPlanConfig: { gridWidth: 16, gridHeight: 10 },
  });

  /*
   * four booths in a row. the real-time spec needs at least two free ones so
   * a second exhibitor still has somewhere to go after the first reserves.
   */
  const booths = await Booth.create(
    ['A1', 'A2', 'A3', 'A4'].map((label, i) => ({
      expoRef: expo._id,
      label,
      x: 1 + i * 4,
      y: 1,
      width: 3,
      height: 2,
      status: 'available',
      exhibitorRef: null,
    }))
  );

  const [profileA, profileB] = await ExhibitorProfile.create([
    {
      userRef: exhibitorA._id,
      expoRef: expo._id,
      companyName: 'Okafor Instruments',
      category: 'Instrumentation',
      description: 'Precision measurement for field laboratories.',
      approvalStatus: 'approved',
      products: [{ name: 'Field spectrometer', category: 'Instrumentation', description: 'Portable, battery powered.' }],
    },
    {
      userRef: exhibitorB._id,
      expoRef: expo._id,
      companyName: 'Lin Optics',
      category: 'Optics',
      description: 'Lenses and coatings for imaging systems.',
      approvalStatus: 'approved',
      products: [{ name: 'Broadband coating', category: 'Optics', description: 'Anti-reflective, 400-900nm.' }],
    },
  ]);

  /*
   * two sessions: one with room, one deliberately at capacity 1 so the
   * registration spec can prove capacity is enforced rather than stored.
   */
  const [openSession, fullSession] = await Session.create([
    {
      expoRef: expo._id,
      title: 'Calibration in the field',
      speaker: 'Dr Wren Ashby',
      topic: 'Instrumentation',
      location: 'Room 1',
      startTime: new Date(now + 7 * DAY + 3600e3),
      endTime: new Date(now + 7 * DAY + 2 * 3600e3),
      capacity: 40,
    },
    {
      expoRef: expo._id,
      title: 'One seat only',
      speaker: 'Dr Wren Ashby',
      topic: 'Instrumentation',
      location: 'Room 2',
      startTime: new Date(now + 8 * DAY + 3600e3),
      endTime: new Date(now + 8 * DAY + 2 * 3600e3),
      capacity: 1,
    },
  ]);

  const fixture = {
    password: PASSWORD,
    accounts: ACCOUNTS,
    users: {
      organizer: String(organizer._id),
      pendingOrganizer: String(pendingOrganizer._id),
      exhibitorA: String(exhibitorA._id),
      exhibitorB: String(exhibitorB._id),
      attendee: String(attendee._id),
      attendeeB: String(attendeeB._id),
    },
    expo: { id: String(expo._id), title: expo.title },
    booths: booths.map((b) => ({ id: String(b._id), label: b.label })),
    profiles: { a: String(profileA._id), b: String(profileB._id) },
    sessions: {
      open: { id: String(openSession._id), title: openSession.title },
      full: { id: String(fullSession._id), title: fullSession.title, capacity: 1 },
    },
  };

  await mongoose.disconnect();
  return fixture;
}

if (require.main === module) {
  seed()
    .then((fixture) => {
      if (process.argv.includes('--print')) console.log(JSON.stringify(fixture, null, 2));
      else console.log(`seeded ${fixture.expo.title}: ${fixture.booths.length} booths, 2 sessions, 6 accounts`);
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { seed, ACCOUNTS, PASSWORD };
