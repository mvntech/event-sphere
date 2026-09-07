const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const createRegistrationSchema = z.object({
  expoRef: objectId,
  /** omit to register for the expo itself rather than a single session. */
  sessionRef: objectId.nullable().optional().default(null),
  bookmarked: z.boolean().optional().default(false),
});

const updateRegistrationSchema = z
  .object({ bookmarked: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

module.exports = { createRegistrationSchema, updateRegistrationSchema, objectId };
