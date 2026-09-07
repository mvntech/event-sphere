const { z } = require('zod');
const ExhibitorProfile = require('../models/ExhibitorProfile');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

/**
 * the application form is multipart, so every field arrives as a string.
 * `products` and `staff` come over as JSON strings and are parsed here.
 */
const jsonArray = (schema, label) =>
  z
    .union([z.string(), z.array(z.unknown())])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return [];
      if (Array.isArray(value)) return value;
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        return parsed;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} could not be read` });
        return z.NEVER;
      }
    })
    .pipe(z.array(schema).max(25, `At most 25 ${label.toLowerCase()}`));

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(120),
  category: z.string().trim().min(1, 'Category is required').max(80),
  description: z.string().trim().max(600).optional().default(''),
});

const staffSchema = z.object({
  name: z.string().trim().min(1, 'Staff name is required').max(100),
  role: z.string().trim().max(80).optional().default(''),
  email: z.union([z.string().trim().email('Enter a valid email'), z.literal('')]).optional().default(''),
});

const emailField = z.union([z.string().trim().email('Enter a valid email'), z.literal('')]);
const websiteField = z.union([z.string().trim().url('Enter a full URL, including https://'), z.literal('')]);

const contactFields = {
  email: emailField,
  phone: z.string().trim().max(40),
  website: websiteField,
};

/** on create, every contact key is filled in so the stored shape is complete. */
const contactCreateSchema = z
  .object(contactFields)
  .partial()
  .transform((v) => ({ email: '', phone: '', website: '', ...v }));

/**
 * on update the keys stay optional with NO defaults — the controller merges
 * this over the stored contact, so a default here would blank out any field
 * the user did not resubmit.
 */
const contactPatchSchema = z.object(contactFields).partial();

/** multipart sends nested objects as JSON strings, so parse before validating. */
const jsonObject = (schema, label) =>
  z
    .union([z.string(), z.record(z.unknown())])
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value === '') return {};
      if (typeof value === 'object') return value;
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('not an object');
        }
        return parsed;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} could not be read` });
        return z.NEVER;
      }
    })
    .pipe(schema);

const contactField = jsonObject(contactCreateSchema, 'Contact details');
const contactPatchField = jsonObject(contactPatchSchema, 'Contact details');

const applySchema = z.object({
  expoRef: objectId,
  companyName: z.string().trim().min(2, 'Company name is required').max(140),
  description: z.string().trim().min(20, 'Tell organizers at least a couple of sentences about the company').max(4000),
  category: z.string().trim().min(2, 'Pick a category').max(80),
  contact: contactField,
  products: jsonArray(productSchema, 'Products'),
  staff: jsonArray(staffSchema, 'Staff'),
});

const updateProfileSchema = z
  .object({
    companyName: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().min(20).max(4000).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    contact: contactPatchField.optional(),
    products: jsonArray(productSchema, 'Products').optional(),
    staff: jsonArray(staffSchema, 'Staff').optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

/** organizer decision on an application. a rejection must say why. */
const reviewSchema = z
  .object({
    approvalStatus: z.enum(['approved', 'rejected']),
    reviewNote: z.string().trim().max(1000).optional().default(''),
  })
  .refine((v) => v.approvalStatus !== 'rejected' || v.reviewNote.length >= 5, {
    path: ['reviewNote'],
    message: 'Give the exhibitor a short reason for the rejection',
  });

const listExhibitorsQuery = z.object({
  expoRef: objectId.optional(),
  approvalStatus: z.enum(ExhibitorProfile.APPROVAL_STATUSES).optional(),
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(140).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

module.exports = { applySchema, updateProfileSchema, reviewSchema, listExhibitorsQuery, objectId };
