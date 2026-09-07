const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/boothController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const {
  createBoothSchema,
  updateBoothSchema,
  saveLayoutSchema,
  assignBoothSchema,
  objectId,
} = require('../validators/boothValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));
const expoParam = validateParams(z.object({ expoId: objectId }));

// the floor plan is readable by anyone who can see the expo.
/**
 * @openapi
 * /booths/expo/{expoId}:
 *   get:
 *     tags: [Booths]
 *     security: []
 *     summary: the floor plan for one expo
 *     parameters:
 *       - { in: path, name: expoId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: booths plus the expo's grid configuration }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/expo/:expoId', expoParam, optionalAuth, controller.listByExpo);

// bulk save from the drag-and-drop builder.
/**
 * @openapi
 * /booths/expo/{expoId}/layout:
 *   put:
 *     tags: [Booths]
 *     summary: save the whole floor plan at once
 *     description: >
 *       what the builder's Save button posts. overlapping booths are refused
 *       with a 409 naming the conflicting booth, so the editor can show it
 *       inline rather than failing silently.
 *     parameters:
 *       - { in: path, name: expoId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               booths:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:     { type: string }
 *                     label:  { type: string }
 *                     x:      { type: integer }
 *                     y:      { type: integer }
 *                     width:  { type: integer }
 *                     height: { type: integer }
 *     responses:
 *       200:
 *         description: the saved layout
 *       409:
 *         description: two booths overlap; the response names which
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put(
  '/expo/:expoId/layout',
  expoParam,
  authMiddleware,
  roleGuard('organizer'),
  validate(saveLayoutSchema),
  controller.saveLayout
);

/**
 * @openapi
 * /booths:
 *   post:
 *     tags: [Booths]
 *     summary: add one booth to a floor plan
 *     responses:
 *       201:
 *         description: created
 *       409:
 *         description: it would overlap an existing booth
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', authMiddleware, roleGuard('organizer'), validate(createBoothSchema), controller.createBooth);
/**
 * @openapi
 * /booths/{id}:
 *   patch:
 *     tags: [Booths]
 *     summary: move, resize or rename one booth
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: updated
 *       409:
 *         description: it would overlap an existing booth
 *   delete:
 *     tags: [Booths]
 *     summary: remove a booth from the plan
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: deleted
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id', idParam, authMiddleware, roleGuard('organizer'), validate(updateBoothSchema), controller.updateBooth);
router.delete('/:id', idParam, authMiddleware, roleGuard('organizer'), controller.deleteBooth);

// reservation is the exhibitor's own action against the live plan.
/**
 * @openapi
 * /booths/{id}/reserve:
 *   patch:
 *     tags: [Booths]
 *     summary: reserve a booth
 *     description: >
 *       exhibitor only, and only with an approved application to that expo.
 *       reservation opens once the expo is published. One booth per exhibitor
 *       per expo. broadcasts `booth:updated` to the expo room.
 *     responses:
 *       200: { description: reserved }
 *       400: { description: The expo is not open for reservations yet }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409: { description: Somebody else took it first }
 */
router.patch('/:id/reserve', idParam, authMiddleware, roleGuard('exhibitor'), controller.reserveBooth);
// either the holding exhibitor or the organizer can release.
/**
 * @openapi
 * /booths/{id}/release:
 *   patch:
 *     tags: [Booths]
 *     summary: give a booth back
 *     description: >
 *       available to the exhibitor holding it and to the organizer. broadcasts
 *       `booth:updated`, so anyone watching the plan sees it free immediately.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: released
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id/release', idParam, authMiddleware, roleGuard('exhibitor', 'organizer'), controller.releaseBooth);
/**
 * @openapi
 * /booths/{id}/assign:
 *   patch:
 *     tags: [Booths]
 *     summary: assign a booth to an exhibitor
 *     description: >
 *       the organizer's side of reservation. any booth the exhibitor already
 *       held is freed first, so nobody holds two stands at one expo. Sends the
 *       confirmation email and broadcasts `booth:updated`.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [exhibitorRef]
 *             properties:
 *               exhibitorRef: { type: string }
 *     responses:
 *       200:
 *         description: assigned
 *       400:
 *         description: that exhibitor is not approved, or is on another expo
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch(
  '/:id/assign',
  idParam,
  authMiddleware,
  roleGuard('organizer'),
  validate(assignBoothSchema),
  controller.assignBooth
);

module.exports = router;
