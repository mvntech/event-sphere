import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');

const API_PORT = 5100;
const WEB_PORT = 5174;

export const API_URL = `http://localhost:${API_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

const MONGODB_URI = execFileSync(
  process.execPath,
  ['-e', "process.env.LOG_LEVEL='error';const{buildTestUri}=require('./tests/setup/testDb');process.stdout.write(buildTestUri(undefined,'eventsphere_e2e_test'))"],
  { cwd: BACKEND, encoding: 'utf8' }
);

const backendEnv = {
  ...process.env,
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  PORT: String(API_PORT),
  MONGODB_URI,
  CLIENT_URL: WEB_URL,
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: 'e2e',
  SMTP_PASS: 'e2e',
};

export default defineConfig({
  testDir: './specs',
  outputDir: './.artifacts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  globalSetup: require.resolve('./global-setup'),

  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
  ].flatMap((project) => [
    { name: `${project.name}:seed`, testMatch: /seed\.setup\.ts$/ },
    { ...project, dependencies: [`${project.name}:seed`] },
  ]),

  webServer: [
    {
      command: 'npm run start',
      cwd: BACKEND,
      url: `${API_URL}/api/health`,
      env: backendEnv,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --mode e2e --port ${WEB_PORT} --strictPort`,
      cwd: path.join(ROOT, 'frontend'),
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});

export { MONGODB_URI };
