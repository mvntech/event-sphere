import { z } from 'zod';

/** mirrors backend/src/validators/authValidators.js so both ends agree. */
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128, 'That password is too long')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[0-9]/, 'Add a number');

export const emailSchema = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(100),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(['organizer', 'exhibitor', 'attendee'], { required_error: 'Pick how you will use EventSphere' }),
    consentGiven: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the privacy policy to continue' }),
    }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** public contact form — mirrors the server's contactSchema exactly. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Tell us who you are').max(120),
  email: emailSchema,
  category: z.enum(['general', 'session', 'exhibitor', 'venue', 'technical']),
  content: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(4000, 'That is longer than we can accept'),
});

export type ContactValues = z.infer<typeof contactSchema>;

export type RegisterValues = z.infer<typeof registerSchema>;
export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/** rough strength signal for the register form's meter. */
export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped] };
}
