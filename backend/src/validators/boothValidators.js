const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const coordinate = z.coerce.number().int().min(0, 'Cannot sit outside the floor plan').max(200);
const dimension = z.coerce.number().int().min(1, 'Must be at least 1 cell').max(20, 'At most 20 cells');

const label = z
  .string()
  .trim()
  .min(1, 'Give the booth a label')
  .max(20, 'Keep booth labels short, like "A12"');

const geometry = {
  x: coordinate,
  y: coordinate,
  width: dimension,
  height: dimension,
  label,
  notes: z.string().trim().max(500).optional().default(''),
};

const createBoothSchema = z.object({ ...geometry, expoRef: objectId });

const updateBoothSchema = z
  .object({ ...geometry, notes: z.string().trim().max(500).optional() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/**
 * bulk layout save from the drag-and-drop builder. booths carrying an `id`
 * are updated in place, those without are created, and anything missing from
 * the list is deleted — so one request captures the whole canvas.
 */
const saveLayoutSchema = z.object({
  booths: z
    .array(z.object({ ...geometry, id: objectId.optional() }))
    .max(300, 'That is more booths than a single floor plan supports'),
});

/** organizer assigning (or reassigning) a booth to an approved exhibitor. */
const assignBoothSchema = z.object({
  exhibitorRef: objectId,
});

module.exports = { createBoothSchema, updateBoothSchema, saveLayoutSchema, assignBoothSchema, objectId };
