const { z } = require('zod');
const { ROLES } = require('../models/User');

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email,
  password,
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Choose a valid role' }) }),
  consentGiven: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the privacy policy to create an account' }),
  }),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const forgotPasswordSchema = z.object({ email });

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is missing or malformed'),
  password,
});

const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    avatarUrl: z.string().url().nullable().optional(),
    notificationPrefs: z.object({ email: z.boolean() }).partial().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateMeSchema,
};
