const express = require('express');
const controller = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimiter');
const {
  scheduleSchema,
  matchSchema,
  searchSchema,
  summarizeSchema,
  describeSchema,
  triageSchema,
} = require('../validators/aiValidators');

const router = express.Router();

// every AI route is authenticated, then metered by the dedicated AI limiter.
router.use(authMiddleware);

// status is a plain flag read, not a gemini call, so it stays outside the budget.
/**
 * @openapi
 * /ai/status:
 *   get:
 *     tags: [AI]
 *     summary: whether AI features are configured
 *     description: >
 *       a flag read, not a gemini call, so it sits outside the AI budget. The
 *       frontend uses it to hide AI affordance rather than offer a button that
 *       can only fail.
 *     responses:
 *       200:
 *         description: whether a key is present, and which model is in use
 */
router.get('/status', controller.status);

router.use(aiLimiter);

/**
 * @openapi
 * /ai/schedule:
 *   post:
 *     tags: [AI]
 *     summary: build a personal itinerary from stated interests
 *     description: >
 *       picks sessions that match, resolves time clashes and orders the day. attendees only. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expoRef:   { type: string }
 *               interests: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/schedule', roleGuard('attendee'), validate(scheduleSchema), controller.schedule);
/**
 * @openapi
 * /ai/match:
 *   post:
 *     tags: [AI]
 *     summary: recommend exhibitors for one attendee
 *     description: >
 *       ranks exhibitor profiles against stated interests and what the attendee has already bookmarked. attendees only. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expoRef:   { type: string }
 *               interests: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/match', roleGuard('attendee'), validate(matchSchema), controller.match);
// Search is useful to attendees and to exhibitors sizing up their neighbours.
/**
 * @openapi
 * /ai/search:
 *   post:
 *     tags: [AI]
 *     summary: natural-language exhibitor search
 *     description: >
 *       use a question rather than matching keywords; falls back to keyword search on failure. attendees and exhibitors. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expoRef: { type: string }
 *               query:   { type: string }
 *     responses:
 *       200:
 *         description: structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/search', roleGuard('attendee', 'exhibitor'), validate(searchSchema), controller.search);
/**
 * @openapi
 * /ai/summarize:
 *   post:
 *     tags: [AI]
 *     summary: plain-english read of the analytics
 *     description: >
 *       turns the dashboard figures into a few sentences an organizer can act on. organizers only. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expoRef: { type: string }
 *               days:    { type: integer }
 *     responses:
 *       200:
 *         description: structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/summarize', roleGuard('organizer'), validate(summarizeSchema), controller.summarize);
/**
 * @openapi
 * /ai/generate-description:
 *   post:
 *     tags: [AI]
 *     summary: draft an exhibitor description from notes
 *     description: >
 *       turns rough bullet points into profile copy, meant as a draft to edit. exhibitors only. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName: { type: string }
 *               category:    { type: string }
 *               points:      { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/generate-description', roleGuard('exhibitor'), validate(describeSchema), controller.generateDescription);
/**
 * @openapi
 * /ai/triage-feedback:
 *   post:
 *     tags: [AI]
 *     summary: tag feedback with sentiment and category
 *     description: >
 *       classifies one piece of feedback so the organizer inbox can be sorted. organizers only. counts against the AI limiter — 20 requests
 *       per hour per user in production — and falls back rather than failing
 *       if gemini is unavailable.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:     { type: string }
 *               feedbackRef: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: structured JSON from the model, or the deterministic fallback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */
router.post('/triage-feedback', roleGuard('organizer'), validate(triageSchema), controller.triage);

module.exports = router;
