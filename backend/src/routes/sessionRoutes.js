const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/sessionController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const { createSessionSchema, updateSessionSchema, objectId } = require('../validators/sessionValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));

/**
 * @openapi
 * /sessions/expo/{expoId}:
 *   get:
 *     tags: [Sessions]
 *     security: []
 *     summary: the schedule for one expo
 *     parameters:
 *       - { in: path, name: expoId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: paged sessions }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get(
  '/expo/:expoId',
  validateParams(z.object({ expoId: objectId })),
  optionalAuth,
  controller.listByExpo
);
/**
 * @openapi
 * /sessions/{id}:
 *   get:
 *     tags: [Sessions]
 *     security: []
 *     summary: one session, with its seats remaining
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: the session
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam, optionalAuth, controller.getSession);

/**
 * @openapi
 * /sessions:
 *   post:
 *     tags: [Sessions]
 *     summary: add a session to the schedule
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expoRef, title, startTime, endTime]
 *             properties:
 *               expoRef:   { type: string }
 *               title:     { type: string }
 *               speaker:   { type: string }
 *               topic:     { type: string }
 *               location:  { type: string }
 *               startTime: { type: string, format: date-time }
 *               endTime:   { type: string, format: date-time }
 *               capacity:  { type: integer, nullable: true, description: Null means unlimited }
 *     responses:
 *       201:
 *         description: created
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authMiddleware, roleGuard('organizer'), validate(createSessionSchema), controller.createSession);
/**
 * @openapi
 * /sessions/{id}:
 *   patch:
 *     tags: [Sessions]
 *     summary: edit a session
 *     description: >
 *       broadcasts `schedule:updated` and notifies anyone who bookmarked it.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: updated
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *   delete:
 *     tags: [Sessions]
 *     summary: remove a session from the schedule
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id', idParam, authMiddleware, roleGuard('organizer'), validate(updateSessionSchema), controller.updateSession);
router.delete('/:id', idParam, authMiddleware, roleGuard('organizer'), controller.deleteSession);

module.exports = router;
