const { z } = require('zod');
const User = require('../models/User');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const reviewOrganizerSchema = z
  .object({
    organizerApprovalStatus: z.enum(['approved', 'rejected']),
    reviewNote: z.string().trim().max(500).optional(),
  })
  // a refusal without a reason is not actionable for the person receiving it.
  .refine((v) => v.organizerApprovalStatus !== 'rejected' || (v.reviewNote && v.reviewNote.length >= 5), {
    path: ['reviewNote'],
    message: 'Give a short reason when refusing an organizer account',
  });

const changeRoleSchema = z.object({
  role: z.enum(User.ROLES),
});

module.exports = { reviewOrganizerSchema, changeRoleSchema, objectId };
