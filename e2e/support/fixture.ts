import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

export interface Fixture {
  password: string;
  accounts: Record<
    'organizer' | 'pendingOrganizer' | 'exhibitorA' | 'exhibitorB' | 'attendee' | 'attendeeB',
    string
  >;
  users: Record<string, string>;
  expo: { id: string; title: string };
  booths: { id: string; label: string }[];
  profiles: { a: string; b: string };
  sessions: {
    open: { id: string; title: string };
    full: { id: string; title: string; capacity: number };
  };
}

const FIXTURE_PATH = path.join(__dirname, '..', '.fixture.json');

let loaded: Fixture | null = null;

function read(): Fixture {
  if (!loaded) {
    if (!fs.existsSync(FIXTURE_PATH)) {
      throw new Error(
        `${FIXTURE_PATH} is missing. It is written by each project's seed step, so run ` +
          'the suite with `npx playwright test` rather than importing this module directly.'
      );
    }
    loaded = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Fixture;
  }
  return loaded;
}

export const fixture: Fixture = new Proxy({} as Fixture, {
  get: (_t, prop) => read()[prop as keyof Fixture],
  has: (_t, prop) => prop in read(),
  ownKeys: () => Reflect.ownKeys(read()),
  getOwnPropertyDescriptor: (_t, prop) =>
    Object.getOwnPropertyDescriptor(read(), prop) ?? {
      configurable: true,
      enumerable: true,
      value: read()[prop as keyof Fixture],
    },
});

export async function signIn(page: Page, email: string, password = fixture.password) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);

  const submit = page.getByRole('button', { name: 'Sign in' });

  for (let attempt = 1; ; attempt += 1) {
    const posted = page
      .waitForRequest((r) => r.url().includes('/api/auth/login') && r.method() === 'POST', {
        timeout: 5_000,
      })
      .then(
        () => true,
        () => false
      );

    await submit.click();
    if (await posted) break;

    if (attempt === 3) {
      throw new Error(
        'Clicking "Sign in" never produced a POST /api/auth/login, after 3 attempts. ' +
          'The form is filled and the button is clickable, so this is the page not ' +
          'submitting rather than the credentials being refused.'
      );
    }
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}
