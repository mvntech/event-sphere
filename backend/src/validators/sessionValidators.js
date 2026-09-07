const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const dateTime = z
  .string()
  .min(1, 'Required')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time')
  .transform((v) => new Date(v));

const baseSession = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(160),
  speaker: z.string().trim().min(2, 'Who is presenting?').max(120),
  topic: z.string().trim().min(2, 'What is the topic?').max(120),
  location: z.string().trim().min(2, 'Which room or stage?').max(160),
  description: z.string().trim().max(2000).optional().default(''),
  startTime: dateTime,
  endTime: dateTime,
  // an empty capacity field means unlimited seats.
  capacity: z
    .union([z.coerce.number().int().min(1, 'Capacity must be at least 1').max(100000), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
};

const timesInOrder = (v) => !v.startTime || !v.endTime || v.endTime > v.startTime;

const createSessionSchema = z
  .object({ ...baseSession, expoRef: objectId })
  .refine(timesInOrder, { path: ['endTime'], message: 'End time must be after the start time' });

const updateSessionSchema = z
  .object(baseSession)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })
  .refine(timesInOrder, { path: ['endTime'], message: 'End time must be after the start time' });

module.exports = { createSessionSchema, updateSessionSchema, objectId };
