const db = require('../setup/testDb');

/**
 * the gemini SDK is stubbed here so the suite is fast, deterministic and free.
 * a separate live run (scratchpad/ai-live.mjs) proves the real API calls work —
 * these tests prove the routing, auth, shaping and FALLBACK behavior around them.
 */
const mockGenerateContent = jest.fn();
jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: jest.fn().mockImplementation(() => ({ models: { generateContent: mockGenerateContent } })),
  };
});

const { makeUser, makeExpo, makeSession, as, request, app } = require('../helpers/factories');
const ExhibitorProfile = require('../../src/models/ExhibitorProfile');
const Feedback = require('../../src/models/Feedback');

/** shapes a stubbed Gemini reply the way the SDK returns one. */
const reply = (payload) => ({ text: JSON.stringify(payload) });

beforeAll(db.connect);
afterEach(async () => {
  await db.clear();
  mockGenerateContent.mockReset();
});
afterAll(db.disconnect);

async function approvedExhibitor(expo, overrides = {}) {
  const user = await makeUser('exhibitor');
  const profile = await ExhibitorProfile.create({
    userRef: user.user._id,
    expoRef: expo._id,
    companyName: overrides.companyName ?? 'Helix Robotics',
    description: overrides.description ?? 'Collaborative warehouse robots for mid-size logistics operators.',
    category: overrides.category ?? 'Robotics',
    products: overrides.products ?? [{ name: 'Helix One picking arm', category: 'Automation' }],
    approvalStatus: 'approved',
  });
  return { ...user, profile };
}

describe('AI schedule assistant', () => {
  let organizer;
  let expo;
  let attendee;
  let sessions;

  beforeEach(async () => {
    organizer = await makeUser('organizer');
    expo = await makeExpo(organizer, { status: 'published' });
    attendee = await makeUser('attendee');

    const day = new Date(expo.startDate);
    sessions = await Promise.all([
      makeSession(expo, {
        title: 'Robotics Workshop',
        topic: 'Robotics',
        startTime: new Date(new Date(day).setHours(9, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(10, 0, 0, 0)),
      }),
      makeSession(expo, {
        title: 'Design Systems',
        topic: 'Design',
        startTime: new Date(new Date(day).setHours(11, 0, 0, 0)),
        endTime: new Date(new Date(day).setHours(12, 0, 0, 0)),
      }),
    ]);
  });

  it('returns an itinerary built from a live model response', async () => {
    mockGenerateContent.mockResolvedValue(
      reply({
        itinerary: [{ sessionId: String(sessions[0]._id), reason: 'Directly about robotics.' }],
        summary: 'A focused morning on robotics.',
      })
    );

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(expo._id), interests: 'warehouse robotics and automation' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.itinerary).toHaveLength(1);
    // the response carries the whole session, so the UI renders a card not an id.
    expect(res.body.data.itinerary[0].session.title).toBe('Robotics Workshop');
    expect(res.body.data.summary).toMatch(/robotics/i);
  });

  it('drops a hallucinated session id rather than passing it through', async () => {
    mockGenerateContent.mockResolvedValue(
      reply({
        itinerary: [
          { sessionId: String(sessions[0]._id), reason: 'Real session.' },
          { sessionId: '0123456789abcdef01234567', reason: 'Invented session.' },
        ],
        summary: 'Two sessions.',
      })
    );

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    expect(res.body.data.itinerary).toHaveLength(1);
    expect(res.body.data.itinerary[0].sessionId).toBe(String(sessions[0]._id));
  });

  it('falls back to keyword matching when Gemini errors', async () => {
    mockGenerateContent.mockRejectedValue(new Error('503 model overloaded'));

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    // degraded, not broken — the page still gets a usable itinerary.
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.itinerary.length).toBeGreaterThan(0);
    expect(res.body.data.itinerary[0].session.title).toBe('Robotics Workshop');
  });

  it('falls back when Gemini returns malformed JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not json at all' });

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
  });

  it('never puts two overlapping sessions in the fallback itinerary', async () => {
    // a clash with the 9-10 robotics session.
    await makeSession(expo, {
      title: 'Robotics Clinic',
      topic: 'Robotics',
      startTime: new Date(new Date(expo.startDate).setHours(9, 30, 0, 0)),
      endTime: new Date(new Date(expo.startDate).setHours(10, 30, 0, 0)),
    });

    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    const picked = res.body.data.itinerary.map((i) => i.session);
    for (let a = 0; a < picked.length; a += 1) {
      for (let b = a + 1; b < picked.length; b += 1) {
        const overlap =
          new Date(picked[a].startTime) < new Date(picked[b].endTime) &&
          new Date(picked[b].startTime) < new Date(picked[a].endTime);
        expect(overlap).toBe(false);
      }
    }
  });

  it('rejects an empty interests string', async () => {
    const res = await as(attendee).post('/api/ai/schedule').send({ expoRef: String(expo._id), interests: '' });
    expect(res.status).toBe(400);
  });

  it('is closed to organizers and exhibitors', async () => {
    for (const actor of [organizer, await makeUser('exhibitor')]) {
      const res = await as(actor).post('/api/ai/schedule').send({ expoRef: String(expo._id), interests: 'robotics' });
      expect(res.status).toBe(403);
    }
  });
});

describe('AI exhibitor matchmaking', () => {
  it('returns ranked exhibitors with the full profile attached', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const helix = await approvedExhibitor(expo);
    await approvedExhibitor(expo, { companyName: 'Verdant Systems', category: 'Climate tech' });

    mockGenerateContent.mockResolvedValue(
      reply({ matches: [{ exhibitorId: String(helix.profile._id), score: 95, reason: 'Builds picking arms.' }] })
    );

    const attendee = await makeUser('attendee');
    const res = await as(attendee)
      .post('/api/ai/match')
      .send({ expoRef: String(expo._id), interests: 'automating a warehouse' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.matches).toHaveLength(1);
    expect(res.body.data.matches[0].exhibitor.companyName).toBe('Helix Robotics');
    expect(res.body.data.matches[0].score).toBe(95);
  });

  it('falls back to keyword scoring on an outage', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    await approvedExhibitor(expo);

    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const attendee = await makeUser('attendee');
    const res = await as(attendee)
      .post('/api/ai/match')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.matches[0].exhibitor.companyName).toBe('Helix Robotics');
  });

  it('never recommends an unapproved exhibitor', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });

    const pendingUser = await makeUser('exhibitor');
    const pending = await ExhibitorProfile.create({
      userRef: pendingUser.user._id,
      expoRef: expo._id,
      companyName: 'Still Pending Ltd',
      description: 'An application nobody has reviewed yet at all.',
      category: 'Robotics',
      approvalStatus: 'pending',
    });

    // even if the model names them, they are not in the allowed set.
    mockGenerateContent.mockResolvedValue(
      reply({ matches: [{ exhibitorId: String(pending._id), score: 99, reason: 'Should not appear.' }] })
    );

    const attendee = await makeUser('attendee');
    const res = await as(attendee)
      .post('/api/ai/match')
      .send({ expoRef: String(expo._id), interests: 'robotics' });

    expect(res.body.data.matches).toHaveLength(0);
  });
});

describe('AI semantic search', () => {
  it('returns semantic matches from the model', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const helix = await approvedExhibitor(expo);

    mockGenerateContent.mockResolvedValue(
      reply({
        results: [{ exhibitorId: String(helix.profile._id), reason: 'Picking arms automate warehouses.' }],
        interpretation: 'Looking for warehouse automation.',
      })
    );

    const attendee = await makeUser('attendee');
    const res = await as(attendee)
      .post('/api/ai/search')
      .send({ expoRef: String(expo._id), query: 'someone who can automate my warehouse' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.results[0].exhibitor.companyName).toBe('Helix Robotics');
    expect(res.body.data.interpretation).toBeTruthy();
  });

  it('falls back to the keyword index when Gemini is down', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    await approvedExhibitor(expo);

    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const attendee = await makeUser('attendee');
    const res = await as(attendee)
      .post('/api/ai/search')
      .send({ expoRef: String(expo._id), query: 'Helix' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.results[0].exhibitor.companyName).toBe('Helix Robotics');
  });
});

describe('AI analytics summariser', () => {
  it('summarises an expo for its organizer', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    await makeSession(expo, { capacity: 10 });

    mockGenerateContent.mockResolvedValue(
      reply({
        headline: 'Registrations are healthy.',
        insights: [{ title: 'Sessions', detail: 'One session scheduled.', sentiment: 'neutral' }],
        recommendations: ['Add more robotics content.'],
      })
    );

    const res = await as(organizer).post('/api/ai/summarize').send({ expoRef: String(expo._id) });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.headline).toBeTruthy();
    expect(res.body.data.insights).toHaveLength(1);
    // the figures the summary was based on come back too, so nothing is unverifiable.
    expect(res.body.data.data.sessions.total).toBe(1);
  });

  it('still returns the raw figures when Gemini fails', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    await makeSession(expo);

    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const res = await as(organizer).post('/api/ai/summarize').send({ expoRef: String(expo._id) });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.insights.length).toBeGreaterThan(0);
    expect(res.body.data.data.sessions.total).toBe(1);
  });

  it("refuses to summarise another organizer's expo", async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const other = await makeUser('organizer');

    const res = await as(other).post('/api/ai/summarize').send({ expoRef: String(expo._id) });
    expect(res.status).toBe(403);
  });

  it('is closed to attendees', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    const res = await as(attendee).post('/api/ai/summarize').send({ expoRef: String(expo._id) });
    expect(res.status).toBe(403);
  });
});

describe('AI description generation', () => {
  it('turns bullet points into profile copy', async () => {
    mockGenerateContent.mockResolvedValue(
      reply({ description: 'Helix Robotics builds picking arms.', tagline: 'Robots that pick.' })
    );

    const exhibitor = await makeUser('exhibitor');
    const res = await as(exhibitor)
      .post('/api/ai/generate-description')
      .send({ bulletPoints: ['we build picking arms', 'for warehouses'], companyName: 'Helix Robotics' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.description).toMatch(/Helix/);
    expect(res.body.data.tagline).toBeTruthy();
  });

  it('hands back tidied notes when Gemini is unavailable', async () => {
    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const exhibitor = await makeUser('exhibitor');
    const res = await as(exhibitor)
      .post('/api/ai/generate-description')
      .send({ bulletPoints: ['- we build picking arms', '- for warehouses'], companyName: 'Helix' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    // their own words come back usable, not an error page.
    expect(res.body.data.description).toMatch(/picking arms/);
  });

  it('requires at least one bullet point', async () => {
    const exhibitor = await makeUser('exhibitor');
    const res = await as(exhibitor).post('/api/ai/generate-description').send({ bulletPoints: [] });
    expect(res.status).toBe(400);
  });

  it('is closed to attendees', async () => {
    const attendee = await makeUser('attendee');
    const res = await as(attendee).post('/api/ai/generate-description').send({ bulletPoints: ['hello there'] });
    expect(res.status).toBe(403);
  });
});

describe('AI feedback triage', () => {
  it('tags a stored feedback item and persists the tags', async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    // the submission itself fires background triage; silence it for this test.
    mockGenerateContent.mockResolvedValue(
      reply({ sentiment: 'negative', category: 'Venue', summary: 'Signage was poor.', urgent: false })
    );

    const submitted = await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'The signage near the robotics hall was hard to follow.' });

    const res = await as(organizer)
      .post('/api/ai/triage-feedback')
      .send({ feedbackRef: submitted.body.data.feedback.id });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('ai');
    expect(res.body.data.sentiment).toBe('negative');
    expect(res.body.data.category).toBe('Venue');

    // persisted, so the inbox keeps the tag.
    const stored = await Feedback.findById(submitted.body.data.feedback.id);
    expect(stored.aiSentiment).toBe('negative');
    expect(stored.aiCategory).toBe('Venue');
  });

  it('coerces an unexpected sentiment value to neutral', async () => {
    mockGenerateContent.mockResolvedValue(
      reply({ sentiment: 'ecstatic', category: 'General', summary: 'x', urgent: false })
    );

    const organizer = await makeUser('organizer');
    const res = await as(organizer).post('/api/ai/triage-feedback').send({ text: 'It was fine I suppose.' });

    expect(res.body.data.sentiment).toBe('neutral');
  });

  it('falls back to a keyword heuristic on an outage', async () => {
    mockGenerateContent.mockRejectedValue(new Error('outage'));

    const organizer = await makeUser('organizer');
    const res = await as(organizer)
      .post('/api/ai/triage-feedback')
      .send({ text: 'The wifi was terrible and the signage was confusing.' });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.sentiment).toBe('negative');
  });

  it("refuses to triage another organizer's feedback", async () => {
    const organizer = await makeUser('organizer');
    const expo = await makeExpo(organizer, { status: 'published' });
    const attendee = await makeUser('attendee');

    mockGenerateContent.mockResolvedValue(reply({ sentiment: 'neutral', category: 'General', summary: 'x', urgent: false }));

    const submitted = await as(attendee)
      .post('/api/feedback')
      .send({ expoRef: String(expo._id), content: 'Feedback only its own organizer may triage.' });

    const other = await makeUser('organizer');
    const res = await as(other)
      .post('/api/ai/triage-feedback')
      .send({ feedbackRef: submitted.body.data.feedback.id });

    expect(res.status).toBe(403);
  });

  it('rejects a request with neither an id nor text', async () => {
    const organizer = await makeUser('organizer');
    const res = await as(organizer).post('/api/ai/triage-feedback').send({});
    expect(res.status).toBe(400);
  });
});

describe('AI route protection', () => {
  it('requires authentication on every AI route', async () => {
    const routes = [
      ['/api/ai/schedule', {}],
      ['/api/ai/match', {}],
      ['/api/ai/search', {}],
      ['/api/ai/summarize', {}],
      ['/api/ai/generate-description', {}],
      ['/api/ai/triage-feedback', {}],
    ];

    for (const [url, body] of routes) {
      const res = await request(app).post(url).send(body);
      expect(res.status).toBe(401);
    }
  });

  it('reports whether the AI layer is configured', async () => {
    const attendee = await makeUser('attendee');
    const res = await as(attendee).get('/api/ai/status');

    expect(res.status).toBe(200);
    expect(typeof res.body.data.configured).toBe('boolean');
  });

  it('hides a draft expo from the AI endpoints too', async () => {
    const organizer = await makeUser('organizer');
    const draft = await makeExpo(organizer, { status: 'draft' });
    const attendee = await makeUser('attendee');

    const res = await as(attendee)
      .post('/api/ai/schedule')
      .send({ expoRef: String(draft._id), interests: 'robotics' });

    expect(res.status).toBe(404);
  });
});
