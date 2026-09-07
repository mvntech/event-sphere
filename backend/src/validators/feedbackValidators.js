const { z } = require('zod');
const Feedback = require('../models/Feedback');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const submitFeedbackSchema = z.object({
  expoRef: objectId.optional(),
  content: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(4000, 'That is longer than we can accept'),
  category: z.enum(Feedback.FEEDBACK_CATEGORIES).default('general'),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

/** the public contact form: no account, so name and email are required here. */
const contactSchema = z.object({
  name: z.string().trim().min(2, 'Tell us who you are').max(120),
  email: z.string().trim().toLowerCase().email('That does not look like an email address').max(160),
  content: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(4000, 'That is longer than we can accept'),
  category: z.enum(Feedback.FEEDBACK_CATEGORIES).default('general'),
});

const updateFeedbackSchema = z
  .object({
    status: z.enum(Feedback.FEEDBACK_STATUSES).optional(),
    organizerNote: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

module.exports = { submitFeedbackSchema, contactSchema, updateFeedbackSchema, objectId };
