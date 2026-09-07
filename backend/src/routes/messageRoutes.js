const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { validateParams } = require('../middleware/validate');
const { sendMessageSchema, objectId } = require('../validators/messageValidators');

const router = express.Router();

// every messaging route is private to its participants.
router.use(authMiddleware);

/**
 * @openapi
 * /messages/threads:
 *   get:
 *     tags: [Messages]
 *     summary: your conversations, most recently active first
 *     responses:
 *       200: { description: Threads with their last message and unread count }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/threads', controller.listThreads);
/**
 * @openapi
 * /messages/contacts:
 *   get:
 *     tags: [Messages]
 *     summary: who you are allowed to start a conversation with
 *     description: >
 *       Scoped by role — attendees reach exhibitors, exhibitors reach
 *       organizers and neighboring exhibitors, organizers reach anyone in
 *       their own expos.
 *     responses:
 *       200: { description: Contactable people }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/contacts', controller.listContacts);
/**
 * @openapi
 * /messages/thread/{id}:
 *   get:
 *     tags: [Messages]
 *     summary: one conversation, marked read as a side effect
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: The thread and its messages }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/thread/:id', validateParams(z.object({ id: objectId })), controller.getThread);
/**
 * @openapi
 * /messages:
 *   post:
 *     tags: [Messages]
 *     summary: send a message, opening a thread if there is not one already
 *     description: emits `message:new` to the other participants over Socket.io.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body:        { type: string }
 *               recipientId: { type: string, description: Required when starting a new thread }
 *               threadId:    { type: string, description: Required when replying }
 *               expoRef:     { type: string, nullable: true }
 *     responses:
 *       201: { description: sent }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */
router.post('/', validate(sendMessageSchema), controller.sendMessage);

module.exports = router;
