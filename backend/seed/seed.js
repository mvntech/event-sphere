const path = require('path');
const BE = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(BE, '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require(path.join(BE, 'src/models/User'));
const Expo = require(path.join(BE, 'src/models/Expo'));
const Booth = require(path.join(BE, 'src/models/Booth'));
const Session = require(path.join(BE, 'src/models/Session'));
const Registration = require(path.join(BE, 'src/models/Registration'));
const ExhibitorProfile = require(path.join(BE, 'src/models/ExhibitorProfile'));
const Feedback = require(path.join(BE, 'src/models/Feedback'));
const Message = require(path.join(BE, 'src/models/Message'));
const MessageThread = require(path.join(BE, 'src/models/MessageThread'));
const Notification = require(path.join(BE, 'src/models/Notification'));
const AnalyticsEvent = require(path.join(BE, 'src/models/AnalyticsEvent'));

const fixedExpoId = (key) =>
  new mongoose.Types.ObjectId(
    require('node:crypto').createHash('sha1').update(`eventsphere:seed:expo:${key}`).digest('hex').slice(0, 24)
  );

const MARK = 'SEED::';
const PASSWORD = 'Passw0rd!2026';
const DOMAIN = 'eventsphere.test';

const DAY = 864e5;
const HOUR = 3_600_000;

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

// expos

const EXPOS = [
  {
    key: 'rooted',
    title: 'Rooted — Sustainable Living Fair',
    theme: 'Sustainability',
    location: 'Manchester Central, Hall 1',
    description:
      'Four days of retrofit, repair and low-carbon materials for the people who actually have to specify them. Trade mornings, public afternoons.',
    startsIn: -1,
    days: 3,
    grid: { gridWidth: 24, gridHeight: 16 },
  },
  {
    key: 'northgate',
    title: 'Northgate Technology Fair',
    theme: 'Applied technology',
    location: 'Northgate Exhibition Centre, Hall 2',
    description:
      'Four days of applied engineering across robotics, sensing, materials and clinical tech. Trade-only on the first morning; open to everyone from Friday afternoon.',
    startsIn: 14,
    days: 3,
    grid: { gridWidth: 20, gridHeight: 14 },
  },
  {
    key: 'harvest',
    title: 'Harvest & Provisions Trade Show',
    theme: 'Food & drink',
    location: 'Bristol Beacon, Riverside Suite',
    description:
      'Regional producers meeting buyers. Cheese, cider, cured meat and the cold-chain logistics nobody puts on a poster.',
    startsIn: 46,
    days: 2,
    grid: { gridWidth: 18, gridHeight: 12 },
  },
  {
    key: 'lights',
    title: 'Northern Lights Games Showcase',
    theme: 'Games',
    location: 'Dundee Caird Hall',
    description:
      'Independent studios showing unreleased work, plus a hiring floor for the studios that are actually recruiting.',
    startsIn: 121,
    days: 4,
    grid: { gridWidth: 16, gridHeight: 12 },
  },
];

// exhibitors (18, mixed statuses and categories)

const COMPANIES = [
  { expo: 'rooted', name: 'Halden Robotics', category: 'Robotics', status: 'approved', blurb: 'Pick-and-place arms for short production runs. We tune them on site and leave the tooling with you.' },
  { expo: 'rooted', name: 'Tessellate Analytics', category: 'Software', status: 'approved', blurb: 'Floor-traffic modelling from anonymous sensor counts. No cameras, no badges, no personal data.' },
  { expo: 'rooted', name: 'Kestrel Instruments', category: 'Instrumentation', status: 'approved', blurb: 'Field spectrometers built to be repaired, not replaced. Every part has a number and a price.' },
  { expo: 'rooted', name: 'Northwind Composites', category: 'Materials', status: 'approved', blurb: 'Flax-fibre panels with a published end-of-life route. Lighter than ply at the same stiffness.' },
  { expo: 'rooted', name: 'Lumen Health', category: 'Medical', status: 'approved', blurb: 'Bedside monitoring that degrades gracefully. When the network drops the device keeps recording locally.' },
  { expo: 'rooted', name: 'Verdance Studio', category: 'Design', status: 'approved', blurb: 'Exhibition stand design and build. We do the drawings, the fabrication and the teardown, and reuse the frame between shows.' },
  { expo: 'rooted', name: 'Coppice & Co', category: 'Materials', status: 'approved', blurb: 'Coppiced hardwood for interiors, cut and dried within forty miles of where it grew.' },
  { expo: 'rooted', name: 'Thermal Honesty', category: 'Building services', status: 'pending', blurb: 'Retrofit heat-loss surveys with the assumptions written on the report, not buried in a model.' },
  { expo: 'rooted', name: 'Rill Water Systems', category: 'Building services', status: 'pending', blurb: 'Greywater recovery sized for terraced housing rather than for office towers.' },
  { expo: 'rooted', name: 'Pale Blue Packaging', category: 'Packaging', status: 'rejected', blurb: 'Moulded pulp packaging. Applied to the wrong show — this is a consumer range.' },

  { expo: 'northgate', name: 'Ardent Sensing', category: 'Instrumentation', status: 'approved', blurb: 'Vibration sensors that survive being bolted to something that actually vibrates.' },
  { expo: 'northgate', name: 'Quarry Compute', category: 'Software', status: 'approved', blurb: 'On-premise inference boxes for sites with no useful uplink.' },
  { expo: 'northgate', name: 'Marlow Optics', category: 'Optics', status: 'approved', blurb: 'Broadband anti-reflective coatings, 400–900nm, made to order in small batches.' },
  { expo: 'northgate', name: 'Bellwether Medical', category: 'Medical', status: 'approved', blurb: 'Sterilisable enclosures for theatre equipment. Certified, documented, boring on purpose.' },
  { expo: 'northgate', name: 'Steadfast Actuators', category: 'Robotics', status: 'approved', blurb: 'Linear actuators with published duty cycles instead of marketing numbers.' },
  { expo: 'northgate', name: 'Cairn Materials', category: 'Materials', status: 'approved', blurb: 'Sintered ceramics for wear surfaces. We will tell you where they fail.' },
  { expo: 'northgate', name: 'Wren Interfaces', category: 'Design', status: 'pending', blurb: 'Industrial HMI design for equipment operated in gloves and poor light.' },
  { expo: 'northgate', name: 'Foundry Metrics', category: 'Software', status: 'pending', blurb: 'Shop-floor dashboards that a supervisor can read from six feet away.' },
];

// sessions (18 across the two main expos, by day of their own run)

const SESSIONS = [
  // rooted — day 0
  { expo: 'rooted', day: 0, hour: 10, duration: 120, title: 'Build-up and stand handover', speaker: 'Site team', topic: 'Practice', location: 'Hall 1', capacity: null },
  { expo: 'rooted', day: 0, hour: 14, duration: 60, title: 'Trade preview walkthrough', speaker: 'Ines Ferreira', topic: 'Business', location: 'Hall 1', capacity: 60 },
  // rooted — day 1 (today, while it runs)
  { expo: 'rooted', day: 1, hour: 10, duration: 90, title: 'Doors open and trade breakfast', speaker: 'Front of house', topic: 'Practice', location: 'Foyer', capacity: null },
  { expo: 'rooted', day: 1, hour: 12.5, duration: 60, title: 'Retrofitting a Victorian terrace without ripping it out', speaker: 'Marta Nowak', topic: 'Sustainability', location: 'Hall 1', capacity: 80 },
  { expo: 'rooted', day: 1, hour: 15, duration: 90, title: 'Low-carbon concrete: what actually ships today', speaker: 'Dr Ade Bakare', topic: 'Sustainability', location: 'Hall 1', capacity: 120 },
  { expo: 'rooted', day: 1, hour: 17.5, duration: 120, title: 'Repair cafe, live', speaker: 'Priya Raman', topic: 'Practice', location: 'Workshop A', capacity: 30 },
  // rooted — day 2 and 3
  { expo: 'rooted', day: 2, hour: 11, duration: 60, title: 'Specifying insulation you can defend', speaker: 'Tom Ellery', topic: 'Sustainability', location: 'Hall 2', capacity: 60 },
  { expo: 'rooted', day: 2, hour: 15, duration: 75, title: 'Who pays for the retrofit gap?', speaker: 'Panel', topic: 'Business', location: 'Hall 1', capacity: 150 },
  { expo: 'rooted', day: 3, hour: 13, duration: 45, title: 'Closing remarks and teardown briefing', speaker: 'Site team', topic: 'Practice', location: 'Hall 1', capacity: null },

  // northgate — day 0
  { expo: 'northgate', day: 0, hour: 9, duration: 90, title: 'Registration and coffee', speaker: 'Front desk', topic: 'Practice', location: 'Foyer', capacity: null },
  { expo: 'northgate', day: 0, hour: 11, duration: 45, title: 'Opening remarks', speaker: 'Ines Ferreira', topic: 'Business', location: 'Hall A', capacity: 120 },
  { expo: 'northgate', day: 0, hour: 13.5, duration: 60, title: 'Keynote: What retrieval got wrong', speaker: 'Dr Priya Raman', topic: 'Research', location: 'Hall A', capacity: 200 },
  { expo: 'northgate', day: 0, hour: 16, duration: 60, title: 'Evaluating agents without a benchmark', speaker: 'Tomas Lindqvist', topic: 'Practice', location: 'Studio 2', capacity: 90 },
  // northgate — day 1
  { expo: 'northgate', day: 1, hour: 10, duration: 60, title: 'Small models, hard problems', speaker: 'Aiko Tanaka', topic: 'Research', location: 'Hall B', capacity: 120 },
  { expo: 'northgate', day: 1, hour: 14, duration: 60, title: 'Procurement for ML teams', speaker: 'Nadia Haddad', topic: 'Business', location: 'Room 4', capacity: 60 },
  // northgate — day 2 and 3
  { expo: 'northgate', day: 2, hour: 10.5, duration: 60, title: 'On-device inference in practice', speaker: 'Marcus Vogel', topic: 'Engineering', location: 'Studio 1', capacity: 90 },
  { expo: 'northgate', day: 2, hour: 15, duration: 60, title: 'Designing for model failure', speaker: 'Grace Owusu', topic: 'Design', location: 'Hall A', capacity: 120 },
  { expo: 'northgate', day: 3, hour: 14, duration: 75, title: 'Closing panel: the next 12 months', speaker: 'Panel', topic: 'Business', location: 'Hall A', capacity: 200 },
];

// attendees (12)

const ATTENDEES = [
  'Amara Okafor', 'Sam Iqbal', 'Rowan Vale', 'Lena Fischer', 'Joel Mbeki', 'Priya Shah',
  'Tomas Riera', 'Nina Halvorsen', 'Owen Pritchard', 'Yuki Sato', 'Dara Nwosu', 'Elif Demir',
];

const FEEDBACK = [
  { text: 'The floor plan on my phone was the only reason I found stand B12. Genuinely useful.', rating: 5 },
  { text: 'Signage in Hall 2 was poor — I walked past my own session twice.', rating: 2 },
  { text: 'Sessions ran to time all four days, which almost never happens. Thank you.', rating: 5 },
  { text: 'Coffee queue at 10am was twenty minutes. Consider a second urn.', rating: 3 },
  { text: 'Exhibitor search found me three suppliers I did not know existed.', rating: 5 },
  { text: 'Wifi dropped repeatedly in the workshop room during the live repair session.', rating: 2 },
];

// helpers

function bank({ prefix, rows, perRow, width, height, x0 = 1, y0 = 1, gapX = 1, gapY = 2 }) {
  const out = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < perRow; c += 1) {
      out.push({
        label: `${prefix}${r * perRow + c + 1}`,
        x: x0 + c * (width + gapX),
        y: y0 + r * (height + gapY),
        width,
        height,
      });
    }
  }
  return out;
}

const LAYOUTS = {
  rooted: bank({ prefix: 'R', rows: 4, perRow: 6, width: 3, height: 2 }),
  northgate: bank({ prefix: 'N', rows: 4, perRow: 5, width: 3, height: 2 }),
};

function boothStatusAt(i, approvedCount) {
  if (i < approvedCount) return 'assigned';
  if (i < approvedCount + 3) return 'reserved';
  return 'available';
}

function timesFor(expoStart, rows) {
  const base = startOfDay(expoStart);

  const built = rows.map((row) => {
    const start = new Date(base.getTime() + row.day * DAY + row.hour * HOUR);
    return { ...row, startTime: start, endTime: new Date(start.getTime() + row.duration * 60_000) };
  });

  const today = startOfDay(new Date()).getTime();
  const todays = built.filter((s) => startOfDay(s.startTime).getTime() === today);
  if (todays.length === 0) return built;

  const pivot = todays[Math.floor(todays.length / 2)];
  let delta = Date.now() - (pivot.startTime.getTime() + 15 * 60_000);

  const first = todays[0].startTime.getTime() + delta;
  const last = todays[todays.length - 1].endTime.getTime() + delta;
  if (first < today + 6 * HOUR) delta += today + 6 * HOUR - first;
  if (last > today + 23 * HOUR) delta -= last - (today + 23 * HOUR);

  const covers = (offset) =>
    todays.some((s) => s.startTime.getTime() + offset <= Date.now() && s.endTime.getTime() + offset > Date.now());

  if (!covers(delta)) {
    const wanted = Date.now() - 20 * 60_000 - todays[todays.length - 1].startTime.getTime();
    if (todays[0].startTime.getTime() + wanted >= today + 6 * HOUR) delta = wanted;
  }

  for (const s of todays) {
    s.startTime = new Date(s.startTime.getTime() + delta);
    s.endTime = new Date(s.endTime.getTime() + delta);
  }
  return built;
}

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
const pick = (list, i) => list[i % list.length];

// clean

async function clean() {
    const expos = await Expo.find({
    $or: [
      { _id: { $in: EXPOS.map((e) => fixedExpoId(e.key)) } },
      { description: { $regex: `^${LEGACY_MARK}` } },
    ],
  })
    .select('_id')
    .lean();
  const expoIds = expos.map((e) => e._id);
  const users = await User.find({ email: { $regex: `@${DOMAIN}$` } }).select('_id').lean();
  const userIds = users.map((u) => u._id);
  const threads = await MessageThread.find({ expoRef: { $in: expoIds } }).select('_id').lean();

  const removed = {
    messages: (await Message.deleteMany({ threadRef: { $in: threads.map((t) => t._id) } })).deletedCount,
    threads: (await MessageThread.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    analytics: (await AnalyticsEvent.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    notifications: (await Notification.deleteMany({ userRef: { $in: userIds } })).deletedCount,
    feedback: (await Feedback.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    registrations: (await Registration.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    sessions: (await Session.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    booths: (await Booth.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    profiles: (await ExhibitorProfile.deleteMany({ expoRef: { $in: expoIds } })).deletedCount,
    expos: (await Expo.deleteMany({ _id: { $in: expoIds } })).deletedCount,
    users: (await User.deleteMany({ _id: { $in: userIds } })).deletedCount,
  };
  return removed;
}

// seed

async function seed() {
  await clean();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const base = { passwordHash, consentGiven: true };

  // organizers: one approved and running everything, one still pending so the
  // approval queue has something to show.
  const [organizer, pendingOrganizer] = await User.create([
    { ...base, name: 'Ines Ferreira', email: `organizer@${DOMAIN}`, role: 'organizer', organizerApprovalStatus: 'approved' },
    { ...base, name: 'Marcus Vogel', email: `organizer.pending@${DOMAIN}`, role: 'organizer', organizerApprovalStatus: 'pending' },
  ]);

  const now = Date.now();
  const expos = {};
  for (const row of EXPOS) {
    const start = new Date(now + row.startsIn * DAY);
    expos[row.key] = await Expo.create({
      _id: fixedExpoId(row.key),
      organizerRef: organizer._id,
      title: row.title,
      description: row.description,
      theme: row.theme,
      location: row.location,
      startDate: start,
      endDate: new Date(start.getTime() + row.days * DAY),
      status: 'published',
      floorPlanConfig: row.grid,
    });
  }

  // exhibitors
  const profiles = [];
  for (const [i, company] of COMPANIES.entries()) {
    const user = await User.create({
      ...base,
      name: company.name,
      email: `${slug(company.name)}@${DOMAIN}`,
      role: 'exhibitor',
    });
    profiles.push(
      await ExhibitorProfile.create({
        userRef: user._id,
        expoRef: expos[company.expo]._id,
        companyName: company.name,
        category: company.category,
        logoUrl: `/demo/${slug(company.name)}.svg`,
        description: company.blurb,
        approvalStatus: company.status,
        reviewNote: company.status === 'rejected' ? 'Consumer range — try the spring consumer fair instead.' : undefined,
        products: [
          { name: `${company.category} line`, category: company.category, description: company.blurb.slice(0, 90) },
        ],
        staff: [{ name: pick(ATTENDEES, i + 3), role: 'Stand lead' }],
      })
    );
  }

  // floor plans
  const boothCounts = {};
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const expo = expos[key];
    const approved = profiles.filter(
      (p) => String(p.expoRef) === String(expo._id) && p.approvalStatus === 'approved'
    );

    const docs = layout.map((booth, i) => {
      const status = boothStatusAt(i, approved.length);
      return {
        ...booth,
        expoRef: expo._id,
        status,
        exhibitorRef: status === 'assigned' ? approved[i]._id : null,
      };
    });

    await Booth.insertMany(docs);
    boothCounts[key] = docs.length;
  }

  // sessions
  const sessionsByExpo = {};
  for (const key of ['rooted', 'northgate']) {
    const rows = SESSIONS.filter((s) => s.expo === key);
    const timed = timesFor(expos[key].startDate, rows);
    sessionsByExpo[key] = await Session.insertMany(
      timed.map((s) => ({
        expoRef: expos[key]._id,
        title: s.title,
        speaker: s.speaker,
        topic: s.topic,
        location: s.location,
        capacity: s.capacity,
        startTime: s.startTime,
        endTime: s.endTime,
        description: '',
      }))
    );
  }

  // attendees, registrations and bookmarks
  const attendees = await User.create(
    ATTENDEES.map((name) => ({ ...base, name, email: `${slug(name)}@${DOMAIN}`, role: 'attendee' }))
  );

  let registrations = 0;
  const registeredPerSession = new Map();

  for (const [i, attendee] of attendees.entries()) {
    const keys = i % 2 === 0 ? ['rooted', 'northgate'] : ['rooted'];
    for (const key of keys) {
      for (const [j, session] of sessionsByExpo[key].entries()) {
        if ((i + j) % 3 === 0) continue; // not everyone books everything
        await Registration.create({
          attendeeRef: attendee._id,
          expoRef: expos[key]._id,
          sessionRef: session._id,
          status: 'registered',
          bookmarked: (i + j) % 2 === 0,
        });
        registrations += 1;
        registeredPerSession.set(
          String(session._id),
          (registeredPerSession.get(String(session._id)) ?? 0) + 1
        );
      }
    }
  }

  for (const [sessionId, count] of registeredPerSession) {
    await Session.updateOne({ _id: sessionId }, { $set: { registeredCount: count } });
  }

  // feedback
  for (const [i, row] of FEEDBACK.entries()) {
    await Feedback.create({
      userRef: attendees[i % attendees.length]._id,
      expoRef: expos[i % 2 === 0 ? 'rooted' : 'northgate']._id,
      content: row.text,
      rating: row.rating,
      status: i < 4 ? 'new' : 'reviewed',
    });
  }

  // a couple of message threads
  const firstExhibitor = await User.findOne({ email: `${slug(COMPANIES[0].name)}@${DOMAIN}` });
  const thread = await MessageThread.create({
    participants: [attendees[0]._id, firstExhibitor._id],
    pairKey: MessageThread.pairKeyString(attendees[0]._id, firstExhibitor._id),
    kind: 'attendee-exhibitor',
    expoRef: expos.rooted._id,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Live on the stand all four days.',
    lastSenderRef: firstExhibitor._id,
  });
  await Message.create([
    { threadRef: thread._id, senderRef: attendees[0]._id, body: 'Are you demoing the pick-and-place arm on the stand, or is it video only?', readBy: [attendees[0]._id] },
    { threadRef: thread._id, senderRef: firstExhibitor._id, body: 'Live on the stand all four days. Come by after 11 and you can drive it yourself.', readBy: [firstExhibitor._id] },
  ]);

  // analytics
  const analytics = [];
  const rootedBooths = await Booth.find({ expoRef: expos.rooted._id }).select('_id').lean();
  const rootedProfiles = profiles.filter((p) => String(p.expoRef) === String(expos.rooted._id));
  const QUERIES = ['insulation', 'heat pump', 'low carbon concrete', 'greywater', 'flax panel', 'repair'];

  const shape = {
    search: (d) => (d >= 5 && d <= 9 ? 4 : d > 9 ? 2 : 1),
    sessionBookmark: (d) => (d >= 2 && d <= 4 ? 5 : d <= 1 ? 1 : 1),
    boothView: (d) => (d <= 1 ? 14 : d === 2 ? 5 : 1),
    profileView: () => 2,
  };

  for (let d = 13; d >= 0; d -= 1) {
    const when = new Date(now - d * DAY + 11 * HOUR);

    for (let n = 0; n < shape.boothView(d); n += 1) {
      analytics.push({
        expoRef: expos.rooted._id,
        type: 'boothView',
        targetRef: pick(rootedBooths, n * 5 + d)._id,
        userRef: pick(attendees, n * 7 + d * 3)._id,
        createdAt: new Date(when.getTime() + n * 7 * 60_000),
      });
    }
    for (let n = 0; n < shape.profileView(d); n += 1) {
      analytics.push({
        expoRef: expos.rooted._id,
        type: 'profileView',
        targetRef: pick(rootedProfiles, n * 3 + d)._id,
        userRef: pick(attendees, n * 5 + d)._id,
        createdAt: new Date(when.getTime() + n * 11 * 60_000),
      });
    }
    for (let n = 0; n < shape.search(d); n += 1) {
      analytics.push({
        expoRef: expos.rooted._id,
        type: 'search',
        query: pick(QUERIES, n + d),
        userRef: pick(attendees, n * 4 + d * 2)._id,
        createdAt: new Date(when.getTime() + n * 13 * 60_000),
      });
    }
    for (let n = 0; n < shape.sessionBookmark(d); n += 1) {
      analytics.push({
        expoRef: expos.rooted._id,
        type: 'sessionBookmark',
        targetRef: pick(sessionsByExpo.rooted, n + d)._id,
        userRef: pick(attendees, n * 6 + d)._id,
        createdAt: new Date(when.getTime() + n * 17 * 60_000),
      });
    }
  }

  await AnalyticsEvent.insertMany(analytics);

  // notifications for the organizer
  await Notification.create([
    { userRef: organizer._id, type: 'feedback', message: 'Thermal Honesty applied to Rooted — Sustainable Living Fair', link: '/organizer/exhibitors', expoRef: expos.rooted._id, read: false },
    { userRef: organizer._id, type: 'feedback', message: 'New feedback on Rooted — Sustainable Living Fair', link: '/organizer/feedback', expoRef: expos.rooted._id, read: false },
    { userRef: organizer._id, type: 'booth-reserved', message: 'A stand was reserved on Northgate Technology Fair', link: '/organizer/floor-plan', expoRef: expos.northgate._id, read: true },
  ]);

  return {
    organizers: 2,
    expos: Object.keys(expos).length,
    exhibitors: profiles.length,
    booths: Object.values(boothCounts).reduce((a, b) => a + b, 0),
    sessions: Object.values(sessionsByExpo).reduce((a, list) => a + list.length, 0),
    attendees: attendees.length,
    registrations,
    feedback: FEEDBACK.length,
    analytics: analytics.length,
    logins: {
      organizer: `organizer@${DOMAIN}`,
      pendingOrganizer: `organizer.pending@${DOMAIN}`,
      exhibitor: `${slug(COMPANIES[0].name)}@${DOMAIN}`,
      attendee: `${slug(ATTENDEES[0])}@${DOMAIN}`,
      password: PASSWORD,
    },
  };
}

// CLI

async function main() {
  const wantsClean = process.argv.includes('clean');
  await mongoose.connect(process.env.MONGODB_URI);

  if (wantsClean) {
    const removed = await clean();
    console.log('removed:', JSON.stringify(removed));
  } else {
    const summary = await seed();
    console.log(
      `seeded: ${summary.expos} expos · ${summary.exhibitors} exhibitors · ${summary.booths} booths · ` +
        `${summary.sessions} sessions · ${summary.attendees} attendees · ${summary.registrations} registrations · ` +
        `${summary.feedback} feedback · ${summary.analytics} analytics events`
    );
    console.log('\nlogins (all share one password):');
    for (const [role, value] of Object.entries(summary.logins)) {
      if (role !== 'password') console.log(`  ${role.padEnd(18)} ${value}`);
    }
    console.log(`  ${'password'.padEnd(18)} ${summary.logins.password}`);
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error(err.message);
    try { await mongoose.disconnect(); } catch { /* already closed */ }
    process.exit(1);
  });
}

module.exports = { seed, clean, PASSWORD, EXPOS, COMPANIES, ATTENDEES, LAYOUTS, boothStatusAt };
