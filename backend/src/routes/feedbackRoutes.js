const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/feedbackController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const { contactLimiter } = require('../middleware/rateLimiter');
const {
  submitFeedbackSchema,
  contactSchema,
  updateFeedbackSchema,
  objectId,
} = require('../validators/feedbackValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));

// public contact form. registered BEFORE the router-level authMiddleware, so
// it is the one unauthenticated write in the app — and therefore the one that
// carries its own strict limiter (5/hour/IP) rather than the general one.
/**
 * @openapi
 * /feedback/contact:
 *   post:
 *     tags: [Feedback]
 *     security: []
 *     summary: public contact form
 *     description: >
 *       the only unauthenticated write in the API, and therefore the only spam
 *       surface — limited to 5 per hour per IP. Lands in the same collection as
 *       in-app feedback, tagged `source: contact` with a null userRef, so the
 *       organizer inbox can tell the two apart.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, content]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               content: { type: string, minLength: 10, maxLength: 4000 }
 *               category: { type: string, enum: [general, session, exhibitor, venue, technical] }
 *     responses:
 *       201: { description: received }
 *       400: { $ref: '#/components/responses/NotFound' }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/contact', contactLimiter, validate(contactSchema), controller.submitContact);

router.use(authMiddleware);

// feedback submission is open to every role.
/**
 * @openapi
 * /feedback:
 *   post:
 *     tags: [Feedback]
 *     summary: leave feedback on an expo
 *     description: tagged with sentiment and category by the AI triage step.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string }
 *               expoRef: { type: string, nullable: true }
 *               rating:  { type: integer, minimum: 1, maximum: 5 }
 *     responses:
 *       201:
 *         description: submitted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', validate(submitFeedbackSchema), controller.submitFeedback);
/**
 * @openapi
 * /feedback/me:
 *   get:
 *     tags: [Feedback]
 *     summary: feedback you have submitted
 *     responses:
 *       200:
 *         description: your feedback
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', controller.listMine);

// the inbox and triage belong to organizers.
/**
 * @openapi
 * /feedback:
 *   get:
 *     tags: [Feedback]
 *     summary: the organizer inbox
 *     description: >
 *       feedback on your expos plus messages from the public contact form,
 *       marked by source so the two can be told apart.
 *     parameters:
 *       - { in: query, name: expo,      schema: { type: string } }
 *       - { in: query, name: status,    schema: { type: string, enum: [new, reviewed, actioned] } }
 *       - { in: query, name: sentiment, schema: { type: string, enum: [positive, neutral, negative] } }
 *       - { in: query, name: source,    schema: { type: string, enum: [app, contact] } }
 *     responses:
 *       200:
 *         description: Paged feedback
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', roleGuard('organizer'), controller.listFeedback);
/**
 * @openapi
 * /feedback/{id}:
 *   patch:
 *     tags: [Feedback]
 *     summary: move one piece of feedback through the inbox
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [new, reviewed, actioned] }
 *     responses:
 *       200:
 *         description: updated
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id', idParam, roleGuard('organizer'), validate(updateFeedbackSchema), controller.updateFeedback);

module.exports = router;
