import { describe, expect, it } from 'vitest';
import {
  contactSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
  resetPasswordSchema,
} from './validators';

const issueOn = (result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }, field: string) =>
  result.error?.issues.find((i) => i.path.join('.') === field);

const messagesOf = (result: { error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('passwordSchema', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordSchema.safeParse('Passw0rdy').success).toBe(true);
  });

  it.each([
    ['Sh0rt', 'At least 8 characters'],
    ['alllowercase1', 'Add an uppercase letter'],
    ['ALLUPPERCASE1', 'Add a lowercase letter'],
    ['NoDigitsHere', 'Add a number'],
  ])('rejects %s with its own message', (value, message) => {
    const result = passwordSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(message);
  });

  it('rejects a password over 128 characters', () => {
    const result = passwordSchema.safeParse('Aa1' + 'x'.repeat(130));
    expect(messagesOf(result)).toContain('That password is too long');
  });

  it('accepts exactly 8 characters', () => {
    expect(passwordSchema.safeParse('Passw0rd').success).toBe(true);
  });
});

describe('emailSchema', () => {
  it('trims surrounding whitespace', () => {
    const result = emailSchema.safeParse('  someone@example.com  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('someone@example.com');
  });

  it('distinguishes an empty field from a malformed address', () => {
    expect(messagesOf(emailSchema.safeParse(''))).toContain('Email is required');
    expect(messagesOf(emailSchema.safeParse('not-an-email'))).toContain(
      'Enter a valid email address'
    );
  });

  it('treats whitespace only as empty', () => {
    expect(messagesOf(emailSchema.safeParse('   '))).toContain('Email is required');
  });
});

describe('registerSchema', () => {
  const valid = {
    name: 'Ada Reyes',
    email: 'ada@example.com',
    password: 'Passw0rdy',
    confirmPassword: 'Passw0rdy',
    role: 'attendee' as const,
    consentGiven: true as const,
  };

  it('accepts a complete registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('reports a password mismatch on the confirmation field', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different1' });
    expect(result.success).toBe(false);
    expect(issueOn(result, 'confirmPassword')?.message).toBe('Passwords do not match');
    expect(issueOn(result, 'password')).toBeUndefined();
  });

  it('requires consent, with the wording the checkbox shows', () => {
    const result = registerSchema.safeParse({ ...valid, consentGiven: false });
    expect(issueOn(result, 'consentGiven')?.message).toBe(
      'Please accept the privacy policy to continue'
    );
  });

  it('requires a role to be chosen', () => {
    const { role: _role, ...withoutRole } = valid;
    const result = registerSchema.safeParse(withoutRole);
    expect(issueOn(result, 'role')?.message).toBe('Pick how you will use EventSphere');
  });

  it('rejects an unknown role', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });

  it('rejects a one-character name', () => {
    expect(issueOn(registerSchema.safeParse({ ...valid, name: 'A' }), 'name')?.message).toBe(
      'Enter your full name'
    );
  });

  it('accepts all three real roles', () => {
    for (const role of ['organizer', 'exhibitor', 'attendee'] as const) {
      expect(registerSchema.safeParse({ ...valid, role }).success).toBe(true);
    }
  });
});

describe('loginSchema', () => {
  it('accepts any non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
  });

  it('requires a password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: '' });
    expect(issueOn(result, 'password')?.message).toBe('Password is required');
  });
});

describe('forgotPasswordSchema', () => {
  it('needs a valid address', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('applies the full password rules', () => {
    const result = resetPasswordSchema.safeParse({ password: 'weak', confirmPassword: 'weak' });
    expect(messagesOf(result)).toContain('At least 8 characters');
  });

  it('reports a mismatch on the confirmation field', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Passw0rdy',
      confirmPassword: 'Passw0rdz',
    });
    expect(issueOn(result, 'confirmPassword')?.message).toBe('Passwords do not match');
  });
});

describe('contactSchema', () => {
  const valid = {
    name: 'Ada Reyes',
    email: 'ada@example.com',
    category: 'general' as const,
    content: 'I would like to ask about exhibiting at the spring fair.',
  };

  it('accepts a complete message', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('asks for more than a few words', () => {
    expect(issueOn(contactSchema.safeParse({ ...valid, content: 'hi' }), 'content')?.message).toBe(
      'Tell us a little more — at least 10 characters'
    );
  });

  it('caps the message length', () => {
    const result = contactSchema.safeParse({ ...valid, content: 'x'.repeat(4001) });
    expect(issueOn(result, 'content')?.message).toBe('That is longer than we can accept');
  });

  it('rejects a category outside the list', () => {
    expect(contactSchema.safeParse({ ...valid, category: 'other' }).success).toBe(false);
  });

  it('accepts every category the form offers', () => {
    for (const category of ['general', 'session', 'exhibitor', 'venue', 'technical'] as const) {
      expect(contactSchema.safeParse({ ...valid, category }).success).toBe(true);
    }
  });

  it('counts length after trimming', () => {
    expect(contactSchema.safeParse({ ...valid, content: `   ${'x'.repeat(9)}   ` }).success).toBe(
      false
    );
  });
});
