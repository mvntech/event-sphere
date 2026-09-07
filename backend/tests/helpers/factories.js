const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const Expo = require('../../src/models/Expo');
const Session = require('../../src/models/Session');

let counter = 0;
const uniq = () => `${Date.now()}-${(counter += 1)}`;

/** creates a user and returns them with a usable access token. */
async function makeUser(role = 'attendee', overrides = {}) {
  const password = 'Password123';
  const email = overrides.email ?? `${role}-${uniq()}@eventsphere.test`;

  const user = new User({
    name: overrides.name ?? `Test ${role}`,
    email,
    role,
    consentGiven: true,
  });
  await user.setPassword(password);
  await user.save();

  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);

  return { user, password, accessToken: res.body.data.accessToken, id: String(user._id) };
}

const DAY = 24 * 60 * 60 * 1000;

async function makeExpo(organizer, overrides = {}) {
  const start = overrides.startDate ?? new Date(Date.now() + 30 * DAY);
  const end = overrides.endDate ?? new Date(Date.now() + 32 * DAY);

  return Expo.create({
    organizerRef: organizer.user._id,
    title: overrides.title ?? `TechConnect Expo ${uniq()}`,
    description: overrides.description ?? 'A large technology trade show with plenty going on across three days.',
    theme: overrides.theme ?? 'Technology',
    location: overrides.location ?? 'Karachi Expo Centre',
    startDate: start,
    endDate: end,
    status: overrides.status ?? 'published',
  });
}

async function makeSession(expo, overrides = {}) {
  const start = overrides.startTime ?? new Date(new Date(expo.startDate).setHours(10, 0, 0, 0));
  const end = overrides.endTime ?? new Date(new Date(expo.startDate).setHours(11, 0, 0, 0));

  return Session.create({
    expoRef: expo._id,
    title: overrides.title ?? `Keynote ${uniq()}`,
    speaker: overrides.speaker ?? 'Dr Amara Khan',
    topic: overrides.topic ?? 'Applied robotics',
    location: overrides.location ?? 'Main Stage',
    startTime: start,
    endTime: end,
    capacity: overrides.capacity === undefined ? null : overrides.capacity,
  });
}

/** supertest request pre-authenticated as the given actor. */
const as = (actor) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${actor.accessToken}`),
  post: (url) => request(app).post(url).set('Authorization', `Bearer ${actor.accessToken}`),
  put: (url) => request(app).put(url).set('Authorization', `Bearer ${actor.accessToken}`),
  patch: (url) => request(app).patch(url).set('Authorization', `Bearer ${actor.accessToken}`),
  delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${actor.accessToken}`),
});

module.exports = { makeUser, makeExpo, makeSession, as, app, request, DAY };
