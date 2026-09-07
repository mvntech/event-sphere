const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/registrationController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const {
  createRegistrationSchema,
  updateRegistrationSchema,
  objectId,
} = require('../validators/registrationValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));

// registration is an attendee action throughout.
router.use(authMiddleware, roleGuard('attendee'));

/**
 * @openapi
 * /registrations:
 *   post:
 *     tags: [Registrations]
 *     summary: register for an expo, or for one session within it
 *     description: >
 *       capacity is enforced here, not merely stored: a session with no seats
 *       left is refused rather than over-booked.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expoRef]
 *             properties:
 *               expoRef:    { type: string }
 *               sessionRef: { type: string, nullable: true }
 *               bookmarked: { type: boolean }
 *     responses:
 *       201: { description: registered }
 *       400: { description: the session is full, or already registered }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/', validate(createRegistrationSchema), controller.createRegistration);
/**
 * @openapi
 * /registrations/me:
 *   get:
 *     tags: [Registrations]
 *     summary: everything you have registered for or bookmarked
 *     parameters:
 *       - { in: query, name: expo, schema: { type: string }, description: Limit to one expo }
 *     responses:
 *       200: { description: your registrations, session and expo populated }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', controller.listMine);
/**
 * @openapi
 * /registrations/{id}:
 *   patch:
 *     tags: [Registrations]
 *     summary: toggle the bookmark on a registration
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { bookmarked: { type: boolean } }
 *     responses:
 *       200: { description: updated }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Registrations]
 *     summary: cancel a registration, freeing its seat
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: cancelled }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id', idParam, validate(updateRegistrationSchema), controller.updateRegistration);
router.delete('/:id', idParam, controller.cancelRegistration);

module.exports = router;
