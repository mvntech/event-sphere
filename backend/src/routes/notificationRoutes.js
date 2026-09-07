const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');
const { validateParams } = require('../middleware/validate');

const router = express.Router();
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

router.use(authMiddleware);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: your notifications, newest first
 *     parameters:
 *       - { in: query, name: unread, schema: { type: boolean }, description: only the unread ones }
 *     responses:
 *       200: { description: notifications and the unread count }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', controller.listMine);
// declared before '/:id/read' so "read-all" is never parsed as an id.
/**
 * @openapi
 * /notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: mark every notification read
 *     responses:
 *       200: { description: how many were marked }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.patch('/read-all', controller.markAllRead);
/**
 * @openapi
 * /notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: mark one notification read
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: marked read }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.patch('/:id/read', validateParams(z.object({ id: objectId })), controller.markRead);

module.exports = router;
