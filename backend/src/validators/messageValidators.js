const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const sendMessageSchema = z
  .object({
    threadRef: objectId.optional(),
    recipientRef: objectId.optional(),
    expoRef: objectId.optional(),
    subject: z.string().trim().max(160).optional(),
    body: z.string().trim().min(1, 'Write a message first').max(4000, 'That message is too long'),
  })
  // either continue a conversation or start one — the server needs one or the other.
  .refine((v) => v.threadRef || v.recipientRef, {
    path: ['recipientRef'],
    message: 'Say who the message is for',
  });

module.exports = { sendMessageSchema, objectId };
