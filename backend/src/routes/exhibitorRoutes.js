const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/exhibitorController');
const authMiddleware = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateQuery, validateParams } = require('../middleware/validate');
const { uploadApplicationFiles, uploadLogo, uploadDocuments } = require('../middleware/upload');
const {
  applySchema,
  updateProfileSchema,
  reviewSchema,
  listExhibitorsQuery,
  objectId,
} = require('../validators/exhibitorValidators');

const router = express.Router();
const idParam = validateParams(z.object({ id: objectId }));

// the directory is public (approved exhibitors only); organizers see their queue.
/**
 * @openapi
 * /exhibitors:
 *   get:
 *     tags: [Exhibitors]
 *     security: []
 *     summary: the exhibitor directory
 *     parameters:
 *       - { in: query, name: expoRef, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *     responses:
 *       200: { description: Paged approved exhibitor profiles }
 */
router.get('/', optionalAuth, validateQuery(listExhibitorsQuery), controller.listExhibitors);

// must be declared before "/:id" so "me" is not read as an id.
/**
 * @openapi
 * /exhibitors/me:
 *   get:
 *     tags: [Exhibitors]
 *     summary: your own applications, one per expo
 *     description: >
 *       expoRef is null where the expo has since been deleted.
 *     responses:
 *       200:
 *         description: Your profiles
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/me', authMiddleware, roleGuard('exhibitor'), controller.listMine);

/**
 * the application is multipart, so multer runs first to populate `req.body`
 * from the text fields and `req.files` from the attachments — only then can
 * Zod see the body at all.
 */
/**
 * @openapi
 * /exhibitors:
 *   post:
 *     tags: [Exhibitors]
 *     summary: apply to exhibit at an expo
 *     description: >
 *       one application per exhibitor per expo. Applying to two expos means
 *       two applications. documents and a logo can be attached afterwards.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expoRef, companyName, category]
 *             properties:
 *               expoRef:     { type: string }
 *               companyName: { type: string }
 *               category:    { type: string }
 *               description: { type: string }
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:        { type: string }
 *                     category:    { type: string }
 *                     description: { type: string }
 *               staff:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     role: { type: string }
 *     responses:
 *       201:
 *         description: applied, pending review
 *       409:
 *         description: You have already applied to this expo
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/',
  authMiddleware,
  roleGuard('exhibitor'),
  uploadApplicationFiles,
  validate(applySchema),
  controller.apply
);

/**
 * @openapi
 * /exhibitors/{id}:
 *   get:
 *     tags: [Exhibitors]
 *     security: []
 *     summary: one exhibitor profile, with its booth if it has one
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: the profile
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Exhibitors]
 *     summary: edit your own profile
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: updated
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/:id', idParam, optionalAuth, controller.getExhibitor);

router.patch('/:id', idParam, authMiddleware, roleGuard('exhibitor'), validate(updateProfileSchema), controller.updateExhibitor);

// organizer decision on an application.
/**
 * @openapi
 * /exhibitors/{id}/status:
 *   patch:
 *     tags: [Exhibitors]
 *     summary: approve or refuse an application
 *     description: >
 *       organizer-only, and only for an expo you run. emails the applicant
 *       and raises an in-app notification; approving is what opens booth
 *       reservation to them once the expo is published.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approvalStatus]
 *             properties:
 *               approvalStatus: { type: string, enum: [approved, rejected] }
 *               reviewNote:     { type: string, description: Shown to the applicant }
 *     responses:
 *       200:
 *         description: reviewed
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id/status', idParam, authMiddleware, roleGuard('organizer'), validate(reviewSchema), controller.reviewExhibitor);

/**
 * @openapi
 * /exhibitors/{id}/logo:
 *   post:
 *     tags: [Exhibitors]
 *     summary: replace your company logo
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: the stored URL
 *       400:
 *         description: not an image, or too large
 */
router.post('/:id/logo', idParam, authMiddleware, roleGuard('exhibitor'), uploadLogo, controller.replaceLogo);
/**
 * @openapi
 * /exhibitors/{id}/documents:
 *   post:
 *     tags: [Exhibitors]
 *     summary: attach supporting documents to your application
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documents:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: the updated document list
 *       400:
 *         description: too many documents, or an unsupported type
 */
router.post('/:id/documents', idParam, authMiddleware, roleGuard('exhibitor'), uploadDocuments, controller.addDocuments);
/**
 * @openapi
 * /exhibitors/{id}/documents/{documentId}:
 *   delete:
 *     tags: [Exhibitors]
 *     summary: remove one document from your application
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: documentId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: removed
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete(
  '/:id/documents/:documentId',
  validateParams(z.object({ id: objectId, documentId: objectId })),
  authMiddleware,
  roleGuard('exhibitor'),
  controller.removeDocument
);

module.exports = router;
