/**
 * boots the real express app against a throwaway in-memory MongoDB and walks
 * the full auth surface: health, register (all three roles), role guards,
 * silent refresh + rotation, logout, and forgot/reset password. Run with:
 *
 *   npm run smoke
 */
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  // the system temp dir lives on a drive that may be full, so keep the
  // throwaway data files next to the project instead.
  const fs = require('fs');
  const dbPath = process.env.SMOKE_DB_PATH || path.join(__dirname, '.mongo-smoke');
  fs.rmSync(dbPath, { recursive: true, force: true });
  fs.mkdirSync(dbPath, { recursive: true });

  const mongo = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
  const uri = mongo.getUri();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = uri;
  process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'smoke-test-access-secret-value';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'smoke-test-refresh-secret-value';
  process.env.JWT_ACCESS_TTL = '2s'; // short, so expiry/refresh is observable.
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.LOG_LEVEL = 'error';

  const request = require('supertest');
  const mongoose = require('mongoose');
  const { connectDB } = require(path.join(__dirname, '../src/config/db'));
  const app = require(path.join(__dirname, '../src/app'));

  await connectDB(uri);

  const results = [];
  const check = (name, condition, detail = '') => {
    results.push({ name, pass: !!condition, detail });
    console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail && !condition ? ` — ${detail}` : ''}`);
  };

  const agent = request.agent(app);

  // 1. health
  const health = await agent.get('/api/health');
  check('GET /api/health returns 200 with DB status', health.status === 200 && health.body.data.services.database.status === 'up', JSON.stringify(health.body));

  // 2. register each role
  const accounts = {};
  for (const role of ['organizer', 'exhibitor', 'attendee']) {
    const res = await request(app).post('/api/auth/register').send({
      name: `Test ${role}`,
      email: `${role}@example.com`,
      password: 'Passw0rdTest',
      role,
      consentGiven: true,
    });
    accounts[role] = { token: res.body?.data?.accessToken, cookie: res.headers['set-cookie'] };
    check(`register as ${role}`, res.status === 201 && res.body.data.user.role === role, JSON.stringify(res.body));
  }

  // 3. password is hashed, never returned
  const User = require(path.join(__dirname, '../src/models/User'));
  const stored = await User.findOne({ email: 'attendee@example.com' }).select('+passwordHash');
  check('password stored as a bcrypt hash', stored.passwordHash.startsWith('$2') && stored.passwordHash !== 'Passw0rdTest');

  // 4. validation
  const weak = await request(app).post('/api/auth/register').send({
    name: 'X', email: 'not-an-email', password: 'short', role: 'attendee', consentGiven: false,
  });
  check('invalid registration rejected with field errors', weak.status === 400 && Array.isArray(weak.body.errors) && weak.body.errors.length >= 4, JSON.stringify(weak.body));

  const duplicate = await request(app).post('/api/auth/register').send({
    name: 'Dup', email: 'attendee@example.com', password: 'Passw0rdTest', role: 'attendee', consentGiven: true,
  });
  check('duplicate email rejected with 409', duplicate.status === 409, JSON.stringify(duplicate.body));

  // 5. login
  const login = await agent.post('/api/auth/login').send({ email: 'attendee@example.com', password: 'Passw0rdTest' });
  check('login returns an access token and sets the refresh cookie', login.status === 200 && !!login.body.data.accessToken && /es_refresh=/.test(String(login.headers['set-cookie'])));

  const badLogin = await request(app).post('/api/auth/login').send({ email: 'attendee@example.com', password: 'WrongPassw0rd' });
  check('wrong password rejected with a non-enumerating 401', badLogin.status === 401 && badLogin.body.message === 'Incorrect email or password');

  const attendeeToken = login.body.data.accessToken;

  // 6. authorization
  const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${attendeeToken}`);
  check('GET /api/users/me returns the signed-in user', me.status === 200 && me.body.data.user.email === 'attendee@example.com');

  const noToken = await request(app).get('/api/users/me');
  check('GET /api/users/me without a token returns 401', noToken.status === 401);

  const wrongRole = await request(app).get('/api/users/scope/organizer').set('Authorization', `Bearer ${attendeeToken}`);
  check('attendee hitting an organizer-only route gets 403', wrongRole.status === 403, JSON.stringify(wrongRole.body));

  // fresh login: the 2s access TTL set above can outrun the registration step.
  const organizerLogin = await request(app).post('/api/auth/login').send({ email: 'organizer@example.com', password: 'Passw0rdTest' });
  const rightRole = await request(app).get('/api/users/scope/organizer').set('Authorization', `Bearer ${organizerLogin.body.data.accessToken}`);
  check('organizer hitting an organizer-only route gets 200', rightRole.status === 200, JSON.stringify(rightRole.body));

  // 7. noSQL injection attempt
  const injection = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
  check('NoSQL injection payload is rejected, not authenticated', injection.status !== 200, JSON.stringify(injection.body));

  // 8. access token expiry then silent refresh
  await new Promise((r) => setTimeout(r, 2500));
  const expired = await request(app).get('/api/users/me').set('Authorization', `Bearer ${attendeeToken}`);
  check('expired access token is refused', expired.status === 401 && /expired/i.test(expired.body.message));

  const refreshed = await agent.post('/api/auth/refresh');
  check('refresh (cookie only) mints a new access token', refreshed.status === 200 && !!refreshed.body.data.accessToken && refreshed.body.data.accessToken !== attendeeToken);

  const rotated = await request(app).get('/api/users/me').set('Authorization', `Bearer ${refreshed.body.data.accessToken}`);
  check('the refreshed access token works', rotated.status === 200);

  // 9. refresh token rotation — the old one must not be reusable
  const oldRefreshCookie = String(login.headers['set-cookie']).split(';')[0];
  const replay = await request(app).post('/api/auth/refresh').set('Cookie', oldRefreshCookie);
  check('a rotated-away refresh token is rejected (replay protection)', replay.status === 401, JSON.stringify(replay.body));

  // 10. logout
  const loggedOut = await agent.post('/api/auth/logout');
  check('logout succeeds', loggedOut.status === 200);
  const afterLogout = await agent.post('/api/auth/refresh');
  check('refresh after logout is rejected', afterLogout.status === 401);

  // 11. forgot / reset password
  const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'attendee@example.com' });
  check('forgot-password accepts a known email', forgot.status === 200);

  const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
  check('forgot-password gives an identical answer for an unknown email', unknown.status === 200 && unknown.body.message === forgot.body.message);

  // pull the token the way the emailed link would carry it.
  const crypto = require('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const target = await User.findOne({ email: 'attendee@example.com' }).select('+passwordResetTokenHash +passwordResetExpires');
  target.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  target.passwordResetExpires = new Date(Date.now() + 60_000);
  await target.save();

  const badReset = await request(app).post('/api/auth/reset-password').send({ token: 'a'.repeat(40), password: 'BrandNewPass1' });
  check('reset with a bogus token is rejected', badReset.status === 400);

  const reset = await request(app).post('/api/auth/reset-password').send({ token: rawToken, password: 'BrandNewPass1' });
  check('reset with a valid token succeeds', reset.status === 200, JSON.stringify(reset.body));

  const oldPassword = await request(app).post('/api/auth/login').send({ email: 'attendee@example.com', password: 'Passw0rdTest' });
  check('the old password no longer works after a reset', oldPassword.status === 401);

  const newPassword = await request(app).post('/api/auth/login').send({ email: 'attendee@example.com', password: 'BrandNewPass1' });
  check('the new password works after a reset', newPassword.status === 200);

  // 12. 404 handling
  const missing = await request(app).get('/api/does-not-exist');
  check('unknown API route returns a JSON 404', missing.status === 404 && missing.body.success === false);

  await mongoose.connection.close();
  await mongo.stop();
  fs.rmSync(dbPath, { recursive: true, force: true });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
