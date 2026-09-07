const { GoogleGenAI, Type } = require('@google/genai');
const env = require('../config/env');
const logger = require('../utils/logger');

const FAST_MODEL = 'gemini-3.5-flash-lite';
const REASONING_MODEL = 'gemini-3.5-flash';

const TIMEOUT_MS = 20000;

let client = null;

function getClient() {
  if (!env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

const isConfigured = () => Boolean(env.GEMINI_API_KEY);

/**
 * rejects if the underlying promise outlives the deadline.
 * the timer is always cleared — otherwise every AI call would leave a pending
 * timeout holding the event loop open until it expired.
 */
function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;

  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms);
  });

  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * one place where the SDK is actually invoked.
 *
 * @param {object}  options
 * @param {string}  options.model              model id
 * @param {string}  options.systemInstruction  role/behavior framing
 * @param {string}  options.prompt             user content
 * @param {object} [options.schema]            response schema; enables JSON mode
 * @param {number} [options.temperature]
 * @returns {Promise<object|string>} parsed JSON when a schema is given, else text
 */
async function callGemini({ model, systemInstruction, prompt, schema, temperature = 0.4 }) {
  const ai = getClient();
  if (!ai) throw new Error('GEMINI_API_KEY is not configured');

  const config = { systemInstruction, temperature };

  // structured output, so the frontend renders real UI instead of loose prose.
  if (schema) {
    config.responseMimeType = 'application/json';
    config.responseSchema = schema;
  }

  const response = await withTimeout(ai.models.generateContent({ model, contents: prompt, config }));
  const text = response.text;

  if (!text) throw new Error('Gemini returned an empty response');
  if (!schema) return text.trim();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini returned malformed JSON');
  }
}

/**
 * runs an AI call and falls back rather than throwing.
 */
async function withFallback(label, attempt, fallback) {
  if (!isConfigured()) {
    logger.warn(`AI unavailable for ${label} — GEMINI_API_KEY is not set; using fallback`);
    return { ...(await fallback()), source: 'fallback', reason: 'not-configured' };
  }

  try {
    const result = await attempt();
    return { ...result, source: 'ai' };
  } catch (error) {
    logger.warn(`AI call failed for ${label}; using fallback`, { message: error.message });
    return { ...(await fallback()), source: 'fallback', reason: 'error' };
  }
}

const truncate = (text, max) => (typeof text === 'string' && text.length > max ? `${text.slice(0, max)}…` : text ?? '');

// 1. schedule assistant

const scheduleSchema = {
  type: Type.OBJECT,
  properties: {
    itinerary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sessionId: { type: Type.STRING },
          reason: { type: Type.STRING, description: 'One sentence on why this fits their interests' },
        },
        required: ['sessionId', 'reason'],
      },
    },
    summary: { type: Type.STRING, description: 'Two sentences describing the shape of the day' },
  },
  required: ['itinerary', 'summary'],
};

/**
 * builds a personalized, conflict-free itinerary.
 * uses the reasoning model: it has to juggle time conflicts and interest
 * matching at once.
 */
async function generateSchedule(interests, availableSessions) {
  const sessions = availableSessions.map((s) => ({
    id: String(s.id ?? s._id),
    title: s.title,
    topic: s.topic,
    speaker: s.speaker,
    location: s.location,
    startTime: new Date(s.startTime).toISOString(),
    endTime: new Date(s.endTime).toISOString(),
    isFull: Boolean(s.isFull),
  }));

  return withFallback(
    'generateSchedule',
    async () => {
      const result = await callGemini({
        model: REASONING_MODEL,
        systemInstruction:
          'You build conference itineraries. Choose sessions matching the attendee\'s interests. ' +
          'Sessions must never overlap in time — if two good ones clash, pick the better fit. ' +
          'Skip sessions marked isFull. Order the itinerary by start time. ' +
          'Only ever use sessionId values from the supplied list.',
        prompt:
          `Attendee interests: ${interests}\n\n` +
          `Available sessions (JSON):\n${JSON.stringify(sessions)}`,
        schema: scheduleSchema,
        temperature: 0.3,
      });

      // The model can still hallucinate an id, so only keep real ones.
      const valid = new Map(sessions.map((s) => [s.id, s]));
      const itinerary = (result.itinerary ?? [])
        .filter((item) => valid.has(item.sessionId))
        .map((item) => ({ ...item, session: valid.get(item.sessionId) }));

      return { itinerary, summary: result.summary ?? '' };
    },
    // fallback: keyword-overlap ranking, then a greedy non-overlapping pick.
    async () => {
      const words = String(interests).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

      const scored = sessions
        .filter((s) => !s.isFull)
        .map((session) => {
          const haystack = `${session.title} ${session.topic} ${session.speaker}`.toLowerCase();
          return { session, score: words.filter((w) => haystack.includes(w)).length };
        })
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score || new Date(a.session.startTime) - new Date(b.session.startTime));

      const chosen = [];
      scored.forEach(({ session }) => {
        const clashes = chosen.some(
          (picked) =>
            new Date(session.startTime) < new Date(picked.session.endTime) &&
            new Date(picked.session.startTime) < new Date(session.endTime)
        );
        if (!clashes) chosen.push({ sessionId: session.id, reason: 'Matches a keyword in your interests', session });
      });

      chosen.sort((a, b) => new Date(a.session.startTime) - new Date(b.session.startTime));

      return {
        itinerary: chosen,
        summary: chosen.length
          ? 'Built from keyword matching while the AI assistant is unavailable.'
          : 'No sessions matched those interests.',
      };
    }
  );
}

// 2. exhibitor matchmaking

const matchSchema = {
  type: Type.OBJECT,
  properties: {
    matches: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          exhibitorId: { type: Type.STRING },
          score: { type: Type.NUMBER, description: 'Relevance from 0 to 100' },
          reason: { type: Type.STRING, description: 'One sentence on why they are worth visiting' },
        },
        required: ['exhibitorId', 'score', 'reason'],
      },
    },
  },
  required: ['matches'],
};

/** Shrinks a profile to what the model needs, keeping prompts cheap. */
const compactProfile = (profile) => ({
  id: String(profile.id ?? profile._id),
  companyName: profile.companyName,
  category: profile.category,
  description: truncate(profile.description, 400),
  products: (profile.products ?? []).slice(0, 6).map((p) => `${p.name} (${p.category})`),
});

async function matchExhibitors(attendeeInterests, exhibitorProfiles) {
  const profiles = exhibitorProfiles.map(compactProfile);

  return withFallback(
    'matchExhibitors',
    async () => {
      const result = await callGemini({
        model: FAST_MODEL,
        systemInstruction:
          'You recommend trade-show exhibitors. Rank only exhibitors genuinely relevant to the stated ' +
          'interests, best first, at most 8. Omit weak matches entirely rather than padding the list. ' +
          'Only use exhibitorId values from the supplied list.',
        prompt: `Attendee interests: ${attendeeInterests}\n\nExhibitors (JSON):\n${JSON.stringify(profiles)}`,
        schema: matchSchema,
        temperature: 0.3,
      });

      const valid = new Map(profiles.map((p) => [p.id, p]));
      const matches = (result.matches ?? [])
        .filter((m) => valid.has(m.exhibitorId))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      return { matches };
    },
    async () => {
      const words = String(attendeeInterests).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

      const matches = profiles
        .map((profile) => {
          const haystack = `${profile.companyName} ${profile.category} ${profile.description} ${profile.products.join(' ')}`.toLowerCase();
          const hits = words.filter((w) => haystack.includes(w)).length;
          return { exhibitorId: profile.id, score: hits * 20, reason: 'Matches a keyword in your interests' };
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      return { matches };
    }
  );
}

// 3. semantic search

const searchSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          exhibitorId: { type: Type.STRING },
          reason: { type: Type.STRING, description: 'Why this answers the query' },
        },
        required: ['exhibitorId', 'reason'],
      },
    },
    interpretation: { type: Type.STRING, description: 'What the query was understood to mean' },
  },
  required: ['results', 'interpretation'],
};

/**
 * natural-language exhibitor search.
 * falls back to the caller's keyword search when gemini is unavailable.
 */
async function semanticSearch(query, exhibitorProfiles, keywordFallback) {
  const profiles = exhibitorProfiles.map(compactProfile);

  return withFallback(
    'semanticSearch',
    async () => {
      const result = await callGemini({
        model: FAST_MODEL,
        systemInstruction:
          'You match a natural-language query to trade-show exhibitors by meaning, not just wording. ' +
          '"Someone who can automate my warehouse" should match a robotics company. ' +
          'Return only genuine matches, best first, at most 10. Return an empty list when nothing fits. ' +
          'Only use exhibitorId values from the supplied list.',
        prompt: `Query: ${query}\n\nExhibitors (JSON):\n${JSON.stringify(profiles)}`,
        schema: searchSchema,
        temperature: 0.2,
      });

      const valid = new Set(profiles.map((p) => p.id));
      const results = (result.results ?? []).filter((r) => valid.has(r.exhibitorId)).slice(0, 10);

      return { results, interpretation: result.interpretation ?? '' };
    },
    async () => ({
      results: (typeof keywordFallback === 'function' ? await keywordFallback() : []).map((profile) => ({
        exhibitorId: String(profile.id ?? profile._id),
        reason: 'Keyword match',
      })),
      interpretation: 'Showing keyword matches while smart search is unavailable.',
    })
  );
}

// 4. analytics summarizer

const summarySchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING, description: 'One sentence capturing the single most important finding' },
    insights: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          detail: { type: Type.STRING },
          sentiment: { type: Type.STRING, description: 'positive, neutral or concerning' },
        },
        required: ['title', 'detail', 'sentiment'],
      },
    },
    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['headline', 'insights', 'recommendations'],
};

async function summarizeAnalytics(analyticsData) {
  return withFallback(
    'summarizeAnalytics',
    async () => {
      const result = await callGemini({
        model: REASONING_MODEL,
        systemInstruction:
          'You explain expo analytics to an organizer in plain English. Be concrete and cite the numbers ' +
          'you were given. Never invent figures. Give 3-5 insights and 2-4 practical recommendations. ' +
          'Mark an insight "concerning" only when the data genuinely warrants it.',
        prompt: `Expo analytics (JSON):\n${JSON.stringify(analyticsData)}`,
        schema: summarySchema,
        temperature: 0.4,
      });

      return {
        headline: result.headline ?? '',
        insights: result.insights ?? [],
        recommendations: result.recommendations ?? [],
      };
    },
    // fallback: state the figures plainly rather than pretending to analyze.
    async () => {
      const d = analyticsData ?? {};
      const insights = [];

      if (d.sessions) {
        insights.push({
          title: 'Sessions',
          detail: `${d.sessions.total ?? 0} sessions scheduled with ${d.sessions.totalRegistrations ?? 0} registrations.`,
          sentiment: 'neutral',
        });
      }
      if (d.booths) {
        insights.push({
          title: 'Booths',
          detail: `${d.booths.taken ?? 0} of ${d.booths.total ?? 0} booths taken.`,
          sentiment: 'neutral',
        });
      }
      if (d.exhibitors) {
        insights.push({
          title: 'Exhibitors',
          detail: `${d.exhibitors.approved ?? 0} approved, ${d.exhibitors.pending ?? 0} awaiting review.`,
          sentiment: 'neutral',
        });
      }

      return {
        headline: 'Summary generated without AI — showing the raw figures.',
        insights,
        recommendations: [],
      };
    }
  );
}

// 5. exhibitor description generation

const descriptionSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: 'The polished profile copy' },
    tagline: { type: Type.STRING, description: 'A short strapline under 12 words' },
  },
  required: ['description', 'tagline'],
};

async function generateExhibitorDescription(bulletPoints, context = {}) {
  const points = Array.isArray(bulletPoints) ? bulletPoints.join('\n- ') : String(bulletPoints);

  return withFallback(
    'generateExhibitorDescription',
    async () => {
      const result = await callGemini({
        model: FAST_MODEL,
        systemInstruction:
          'You write exhibitor profile copy for a trade-show directory. Turn rough notes into two or three ' +
          'warm, concrete sentences an attendee would actually read. Plain English, no marketing cliché, ' +
          'no invented facts, no claims beyond the notes. Do not use the words "cutting-edge" or "revolutionary".',
        prompt:
          `Company: ${context.companyName ?? 'Not given'}\n` +
          `Category: ${context.category ?? 'Not given'}\n\n` +
          `Notes:\n- ${points}`,
        schema: descriptionSchema,
        temperature: 0.7,
      });

      return { description: result.description ?? '', tagline: result.tagline ?? '' };
    },
    // without AI, hand back a tidied version of what they typed.
    async () => {
      const cleaned = (Array.isArray(bulletPoints) ? bulletPoints : [String(bulletPoints)])
        .map((line) => String(line).trim().replace(/^[-•*]\s*/, ''))
        .filter(Boolean);

      return {
        description: cleaned.join('. ').replace(/\.\./g, '.'),
        tagline: context.companyName ? `${context.companyName} — ${context.category ?? 'exhibitor'}` : '',
      };
    }
  );
}

// 6. feedback triage

const triageSchema = {
  type: Type.OBJECT,
  properties: {
    sentiment: { type: Type.STRING, description: 'positive, neutral or negative' },
    category: { type: Type.STRING, description: 'Short label, e.g. Venue, Scheduling, Staff, Facilities' },
    summary: { type: Type.STRING, description: 'One short sentence capturing the point' },
    urgent: { type: Type.BOOLEAN, description: 'True when it needs prompt attention' },
  },
  required: ['sentiment', 'category', 'summary', 'urgent'],
};

const SENTIMENTS = ['positive', 'neutral', 'negative'];

async function triageFeedback(feedbackText) {
  return withFallback(
    'triageFeedback',
    async () => {
      const result = await callGemini({
        model: FAST_MODEL,
        systemInstruction:
          'You triage event feedback. Classify sentiment as exactly positive, neutral or negative. ' +
          'Give a short category label. Mark urgent only for safety issues or something blocking people now.',
        prompt: `Feedback:\n${truncate(feedbackText, 2000)}`,
        schema: triageSchema,
        temperature: 0.1,
      });

      const sentiment = SENTIMENTS.includes(result.sentiment) ? result.sentiment : 'neutral';

      return {
        sentiment,
        category: truncate(result.category ?? 'General', 60),
        summary: result.summary ?? '',
        urgent: Boolean(result.urgent),
      };
    },
    // fallback: a small word-list heuristic, honest about being rough.
    async () => {
      const text = String(feedbackText).toLowerCase();
      const negative = ['bad', 'poor', 'terrible', 'awful', 'hard', 'difficult', 'confusing', 'broken', 'slow', 'rude', 'disappoint', 'problem', 'issue', 'lost', 'crowded', 'unable'];
      const positive = ['great', 'excellent', 'good', 'love', 'brilliant', 'helpful', 'smooth', 'enjoyed', 'well', 'perfect', 'fantastic', 'clear'];

      const negHits = negative.filter((w) => text.includes(w)).length;
      const posHits = positive.filter((w) => text.includes(w)).length;

      let sentiment = 'neutral';
      if (negHits > posHits) sentiment = 'negative';
      else if (posHits > negHits) sentiment = 'positive';

      return { sentiment, category: 'General', summary: truncate(feedbackText, 120), urgent: false };
    }
  );
}

module.exports = {
  generateSchedule,
  matchExhibitors,
  semanticSearch,
  summarizeAnalytics,
  generateExhibitorDescription,
  triageFeedback,
  isConfigured,
  FAST_MODEL,
  REASONING_MODEL,
};
