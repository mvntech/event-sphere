const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/userController');
const adminController = require('../controllers/adminUserController');
const authMiddleware = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const { updateMeSchema } = require('../validators/authValidators');
const { reviewOrganizerSchema, changeRoleSchema, objectId } = require('../validators/adminUserValidators');

const router = express.Router();

router.use(authMiddleware);

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: your own profile
 *     responses:
 *       200: { description: the signed-in user }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', controller.getMe);
/**
 * @openapi
 * /users/me:
 *   patch:
 *     tags: [Users]
 *     summary: update your own profile and email preferences
 *     description: >
 *       the email toggle covers reminders and decisions only. password
 *       resets always send, so turning it off cannot lock you out of your
 *       own account.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:      { type: string }
 *               avatarUrl: { type: string, nullable: true }
 *               notificationPrefs:
 *                 type: object
 *                 properties:
 *                   email: { type: boolean }
 *     responses:
 *       200:
 *         description: updated
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.patch('/me', validate(updateMeSchema), controller.updateMe);

/**
 * @openapi
 * /users/me/export:
 *   get:
 *     tags: [Users]
 *     summary: download everything stored about you
 *     description: >
 *       GDPR data portability. a JSON attachment covering the account,
 *       registrations, feedback, notifications, exhibitor profiles and messages
 *       *you sent*. messages other people sent you are excluded: that is their
 *       writing, not your data.
 *     responses:
 *       200: { description: a JSON file }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me/export', controller.exportMe);
/**
 * @openapi
 * /users/me/deletion-check:
 *   get:
 *     tags: [Users]
 *     summary: ask whether this account can be deleted
 *     description: >
 *       an organizer who still owns non-cancelled expos cannot delete: their
 *       exhibitors and attendees would be stranded. the blocker names the expos
 *       so the UI can say which ones to transfer or cancel.
 *     responses:
 *       200: { description: canDelete plus any blockers }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me/deletion-check', controller.deletionCheck);
/**
 * @openapi
 * /users/me:
 *   delete:
 *     tags: [Users]
 *     summary: delete your account
 *     description: >
 *       soft delete with immediate anonymisation. name, email, avatar and
 *       password are overwritten at once, so the person stops being
 *       identifiable straight away; the row is purged after 30 days. content
 *       other people can still see keeps its row without an author. refused
 *       with 409 if a blocker applies.
 *     responses:
 *       200: { description: anonymized; purge date returned }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       409: { description: Something blocks deletion }
 */
router.delete('/me', controller.deleteMe);

/** User and role management — organizer only. */
const idParam = validateParams(z.object({ id: objectId }));

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: every account, for role and approval management
 *     description: organizer-only. this is the SRS user-management surface.
 *     parameters:
 *       - { in: query, name: role,   schema: { type: string, enum: [organizer, exhibitor, attendee] } }
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200:
 *         description: paged users
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', roleGuard('organizer'), adminController.listUsers);
/**
 * @openapi
 * /users/{id}/organizer-status:
 *   patch:
 *     tags: [Users]
 *     summary: approve or refuse a pending organizer
 *     description: >
 *       the peer-approval gate. an organizer account is
 *       created but cannot sign in until an existing organizer reviews it,
 *       because organizers can approve exhibitors and read analytics.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizerApprovalStatus]
 *             properties:
 *               organizerApprovalStatus: { type: string, enum: [approved, rejected] }
 *               note:                    { type: string, description: Included in the email }
 *     responses:
 *       200:
 *         description: reviewed, and the applicant emailed
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch(
  '/:id/organizer-status',
  idParam,
  roleGuard('organizer'),
  validate(reviewOrganizerSchema),
  adminController.reviewOrganizer
);
/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: change an account's role
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [organizer, exhibitor, attendee] }
 *     responses:
 *       200:
 *         description: role changed
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.patch('/:id/role', idParam, roleGuard('organizer'), validate(changeRoleSchema), adminController.changeRole);

/**
 * role-scoped probes. the dashboard shells call these on mount so a
 * role-mismatched route reaches the 403 page through the real API guard,
 * not just a client-side check. their content arrives in later phases.
 */
/**
 * @openapi
 * /users/scope/organizer:
 *   get:
 *     tags: [Users]
 *     summary: role-guard probe used by the frontend route wrapper
 *     description: >
 *       confirms the caller holds this role. exists so a protected route can
 *       verify server-side rather than trusting a decoded token.
 *     responses:
 *       200:
 *         description: you hold this role
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/scope/organizer', roleGuard('organizer'), (req, res) =>
  res.json({ success: true, data: { scope: 'organizer' }, message: 'Organizer access confirmed' })
);
/**
 * @openapi
 * /users/scope/exhibitor:
 *   get:
 *     tags: [Users]
 *     summary: role-guard probe for the exhibitor portal
 *     responses:
 *       200:
 *         description: you hold this role
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/scope/exhibitor', roleGuard('exhibitor'), (req, res) =>
  res.json({ success: true, data: { scope: 'exhibitor' }, message: 'Exhibitor access confirmed' })
);
/**
 * @openapi
 * /users/scope/attendee:
 *   get:
 *     tags: [Users]
 *     summary: role-guard probe for the attendee portal
 *     responses:
 *       200:
 *         description: you hold this role
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/scope/attendee', roleGuard('attendee'), (req, res) =>
  res.json({ success: true, data: { scope: 'attendee' }, message: 'Attendee access confirmed' })
);

module.exports = router;
