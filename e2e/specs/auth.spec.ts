import { test, expect } from '@playwright/test';
import { fixture, signIn } from '../support/fixture';

test.describe('authentication', () => {
  test('an attendee can register and lands signed in', async ({ page }) => {
    const email = `e2e.new.${Date.now()}@eventsphere.test`;

    await page.goto('/register');
    await page.getByLabel('Attendee').click();
    await page.getByLabel('Full name').fill('Nadia Farrow');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByLabel('Confirm password').fill(fixture.password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/attendee/);
    await expect(page.getByRole('link', { name: 'EventSphere home' })).toBeVisible();
  });

  test('an organizer registers but cannot sign in until approved', async ({ page }) => {
    const email = `e2e.organizer.${Date.now()}@eventsphere.test`;

    await page.goto('/register');
    await page.getByLabel('Organizer').click();
    await page.getByLabel('Full name').fill('Rowan Vale');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByLabel('Confirm password').fill(fixture.password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/existing organizer has to approve it/i)).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a pending organizer seeded as pending is refused too', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fixture.accounts.pendingOrganizer);
    await page.getByLabel('Password', { exact: true }).fill(fixture.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a wrong password is refused without saying which half was wrong', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(fixture.accounts.attendee);
    await page.getByLabel('Password', { exact: true }).fill('NotThePassword!1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/no account|not registered|unknown email/i);
  });

  test('an attendee cannot reach an organizer route', async ({ page }) => {
    await signIn(page, fixture.accounts.attendee);
    await page.goto('/organizer/expos');
    await expect(page.getByText(/not your page|do not have access|403/i).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /expos/i })).toHaveCount(0);
  });

  test('the session survives an expired access token — silent refresh', async ({ page }) => {
    await signIn(page, fixture.accounts.attendee);
    await expect(page).toHaveURL(/\/attendee$/);

    let rejectedOnce = false;
    await page.route('**/registrations/me**', async (route) => {
      if (!rejectedOnce) {
        rejectedOnce = true;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, message: 'Access token expired' }),
        });
        return;
      }
      await route.continue();
    });

    const refreshed = page.waitForResponse(
      (r) => r.url().includes('/auth/refresh') && r.request().method() === 'POST'
    );

    await page.getByRole('link', { name: 'My schedule' }).click();
    await refreshed;

    expect(rejectedOnce, 'the 401 never fired, so nothing was proven').toBe(true);
    await expect(page).toHaveURL(/\/attendee\/schedule/);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/could not load|try again/i)).toHaveCount(0);
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page, fixture.accounts.attendee);

    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: /sign out|log out/i }).click();

    await expect(page).toHaveURL(/\/(login)?$/);
    await page.goto('/attendee/schedule');
    await expect(page).toHaveURL(/\/login/);
  });
});
