import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { MONGODB_URI } from '../playwright.config';

const BACKEND = path.resolve(__dirname, '..', '..', 'backend');

export const FIXTURE_PATH = path.resolve(__dirname, '..', '.fixture.json');

export function seedFixture(): void {
  let printed: string;

  try {
    printed = execFileSync(process.execPath, ['tests/e2e/seedE2e.js', '--print'], {
      cwd: BACKEND,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error', MONGODB_URI },
    });
  } catch (cause) {
    const { stderr, stdout, status } = cause as {
      stderr?: Buffer | string;
      stdout?: Buffer | string;
      status?: number;
    };
    const detail = [stderr, stdout]
      .map((s) => (s ? String(s).trim() : ''))
      .filter(Boolean)
      .join('\n');

    throw new Error(
      `Seeding the e2e database failed (exit ${status ?? 'unknown'}).` +
        (detail ? `\n\n${detail}` : '\n\nThe seed process printed nothing.')
    );
  }

  fs.writeFileSync(FIXTURE_PATH, printed, 'utf8');
}
