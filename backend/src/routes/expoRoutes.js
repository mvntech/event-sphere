const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/expoController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateQuery, validateParams } = require('../middleware/validate');
const { createExpoSchema, updateExpoSchema, listExposQuery, objectId } = require('../validators/expoValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));

// browsing is public; a signed-in organizer additionally sees their own drafts.
/**
 * @openapi
 * /expos:
 *   get:
 *     tags: [Expos]
 *     security: []
 *     summary: list expos
 *     description: >
 *       public. anonymous callers see published, ongoing and completed expos
 *       only; an organizer passing `mine=true` sees their own, drafts included.
 *     parameters:
 *       - { in: query, name: mine, schema: { type: boolean }, description: Organizer's own expos }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paged expos }
 *   post:
 *     tags: [Expos]
 *     summary: create an expo
 *     description: organizer only.
 *     responses:
 *       201: { description: created }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.get('/', optionalAuth, validateQuery(listExposQuery), controller.listExpos);
/**
 * @openapi
 * /expos/{id}:
 *   get:
 *     tags: [Expos]
 *     security: []
 *     summary: one expo, with counts
 *     description: >
 *       returns `{ expo, stats }` — not a bare expo. a draft is visible only to
 *       the organizer who owns it; everyone else gets 404 rather than 403, so
 *       the endpoint does not confirm that a private expo exists.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: the expo plus sessionCount and exhibitorCount }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id', idParam, optionalAuth, controller.getExpo);

/**
 * @openapi
 * /expos:
 *   post:
 *     tags: [Expos]
 *     summary: create an expo
 *     description: >
 *       starts as a draft, visible only to its organizer, until published.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, startDate, endDate, location]
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               theme:       { type: string }
 *               location:    { type: string }
 *               startDate:   { type: string, format: date-time }
 *               endDate:     { type: string, format: date-time }
 *               status:      { type: string, enum: [draft, published, ongoing, completed, cancelled] }
 *               floorPlanConfig:
 *                 type: object
 *                 properties:
 *                   gridWidth:  { type: integer }
 *                   gridHeight: { type: integer }
 *     responses:
 *       201:
 *         description: created
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authMiddleware, roleGuard('organizer'), validate(createExpoSchema), controller.createExpo);
/**
 * @openapi
 * /expos/{id}:
 *   patch:
 *     tags: [Expos]
 *     summary: update an expo you organize
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: updated
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Expos]
 *     summary: delete an expo you organize
 *     description: >
 *       removes the expo and its floor plan. applications made to it are left
 *       without an expo, which the API reports as a null reference rather than
 *       hiding — clients must handle that.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id', idParam, authMiddleware, roleGuard('organizer'), validate(updateExpoSchema), controller.updateExpo);
router.delete('/:id', idParam, authMiddleware, roleGuard('organizer'), controller.deleteExpo);

module.exports = router;
