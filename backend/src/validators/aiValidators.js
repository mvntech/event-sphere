const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

/** free-text the user supplies to an AI endpoint. Bounded to keep prompts cheap. */
const interests = z
  .string()
  .trim()
  .min(3, 'Tell the assistant a little about what you are interested in')
  .max(500, 'Keep it under 500 characters');

const scheduleSchema = z.object({
  expoRef: objectId,
  interests,
});

const matchSchema = z.object({
  expoRef: objectId,
  interests,
});

const searchSchema = z.object({
  expoRef: objectId,
  query: z
    .string()
    .trim()
    .min(3, 'Describe what you are looking for')
    .max(300, 'Keep the query under 300 characters'),
});

const summarizeSchema = z.object({
  expoRef: objectId,
});

const describeSchema = z.object({
  bulletPoints: z
    .array(z.string().trim().min(1).max(300))
    .min(1, 'Add at least one note for the assistant to work from')
    .max(15, 'That is more notes than the assistant needs'),
  companyName: z.string().trim().max(140).optional(),
  category: z.string().trim().max(80).optional(),
});

const triageSchema = z.object({
  // either triage a stored feedback item, or preview arbitrary text.
  feedbackRef: objectId.optional(),
  text: z.string().trim().min(5).max(4000).optional(),
}).refine((v) => v.feedbackRef || v.text, {
  path: ['text'],
  message: 'Give either a feedback id or some text to triage',
});

module.exports = {
  scheduleSchema,
  matchSchema,
  searchSchema,
  summarizeSchema,
  describeSchema,
  triageSchema,
  objectId,
};
