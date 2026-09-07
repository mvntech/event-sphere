const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const { recordEventSchema, objectId } = require('../validators/analyticsValidators');

const router = express.Router();
const expoParam = validateParams(z.object({ expoId: objectId }));

// reporting a booth view is open to signed-out visitors too — they are still
// floor-plan traffic, and are counted without a user id.
/**
 * @openapi
 * /analytics/events:
 *   post:
 *     tags: [Analytics]
 *     security: []
 *     summary: record one engagement event
 *     description: >
 *       open to signed-out visitors: they are still floor-plan traffic, and are
 *       counted without a user id. This is what the organizer dashboard and the
 *       AI summary aggregate from.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expoRef, type]
 *             properties:
 *               expoRef:   { type: string }
 *               type:      { type: string, enum: [boothView, sessionBookmark, profileView, search] }
 *               targetRef: { type: string, nullable: true }
 *               query:     { type: string, nullable: true }
 *     responses:
 *       201: { description: recorded }
 *       400: { $ref: '#/components/responses/Error' }
 */
router.post('/events', optionalAuth, validate(recordEventSchema), controller.recordEvent);

// reading the dashboard belongs to the organizer running the expo.
/**
 * @openapi
 * /analytics/expo/{expoId}/summary:
 *   get:
 *     tags: [Analytics]
 *     summary: dashboard figures for one expo
 *     description: >
 *       totals, booth traffic, session popularity, booth allocation and the
 *       search terms attendees actually typed. Organizer-only, and only for an
 *       expo you run.
 *     parameters:
 *       - { in: path, name: expoId, required: true, schema: { type: string } }
 *       - { in: query, name: days, schema: { type: integer, default: 14 }, description: Window in days }
 *     responses:
 *       200: { description: the summary }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/expo/:expoId/summary', expoParam, authMiddleware, roleGuard('organizer'), controller.getSummary);
/**
 * @openapi
 * /analytics/expo/{expoId}/events:
 *   get:
 *     tags: [Analytics]
 *     summary: the raw event log behind the summary
 *     parameters:
 *       - { in: path, name: expoId, required: true, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [boothView, sessionBookmark, profileView, search] } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: paged events }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/expo/:expoId/events', expoParam, authMiddleware, roleGuard('organizer'), controller.listEvents);

module.exports = router;
