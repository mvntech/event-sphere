import { test, expect, type Page } from '@playwright/test';
import { fixture, signIn } from '../support/fixture';
import { API_URL } from '../playwright.config';

function sessionCard(page: Page, title: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
}

async function dismissToasts(page: Page) {
  const close = page.locator('[data-sonner-toast] button[data-close-button]');
  for (let i = await close.count(); i > 0; i = await close.count()) {
    await close.first().click({ timeout: 2000 }).catch(() => {});
    if ((await close.count()) === i) break;
  }
}

async function openExpo(page: Page) {
  await page.goto(`/attendee/expos/${fixture.expo.id}`);
  await expect(page.getByRole('heading', { name: fixture.expo.title })).toBeVisible();
  await dismissToasts(page);
}

test.describe('session registration', () => {
  test('an attendee registers for a session and sees it on their schedule', async ({ page }) => {
    await signIn(page, fixture.accounts.attendee);
    await openExpo(page);

    const card = sessionCard(page, fixture.sessions.open.title);
    await card.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Bookmarked', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'My schedule' }).click();
    await expect(
      page.getByRole('heading', { name: fixture.sessions.open.title, exact: true })
    ).toBeVisible();
  });

  test('a registration can be taken back', async ({ page }) => {
    await signIn(page, fixture.accounts.attendee);
    await openExpo(page);

    const card = sessionCard(page, fixture.sessions.open.title);

    const bookmark = card.getByRole('button', { name: 'Bookmark', exact: true });
    const booked = card.getByRole('button', { name: 'Bookmarked', exact: true });

    if (await bookmark.isVisible()) await bookmark.click();
    await expect(booked).toBeVisible();

    await dismissToasts(page);

    await booked.click();
    await expect(bookmark).toBeVisible();
  });

  test('capacity is enforced — a full session refuses the next attendee', async ({ page, browser }) => {
    await signIn(page, fixture.accounts.attendee);
    await openExpo(page);

    const card = sessionCard(page, fixture.sessions.full.title);
    await expect(card).toContainText('1 of 1 seats left');
    await card.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Bookmarked', exact: true })).toBeVisible();
    await dismissToasts(page);

    const otherCtx = await browser.newContext();
    const other = await otherCtx.newPage();
    try {
      await signIn(other, fixture.accounts.attendeeB);
      await other.goto(`/attendee/expos/${fixture.expo.id}`);
      await dismissToasts(other);

      const sameCard = sessionCard(other, fixture.sessions.full.title);
      await expect(sameCard).toContainText('0 of 1 seats left');
      await expect(sameCard.getByText('Full')).toBeVisible();
      await expect(sameCard.getByRole('button', { name: 'Bookmark', exact: true })).toBeDisabled();
    } finally {
      await otherCtx.close();
    }

    await card.getByRole('button', { name: 'Bookmarked', exact: true }).click();
    await expect(card).toContainText('1 of 1 seats left');
  });

  test('the API refuses an over-capacity registration even without the UI', async ({ page, request }) => {
    await signIn(page, fixture.accounts.attendee);
    await openExpo(page);

    const card = sessionCard(page, fixture.sessions.full.title);
    await card.getByRole('button', { name: 'Bookmark', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Bookmarked', exact: true })).toBeVisible();
    await dismissToasts(page);

    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: fixture.accounts.attendeeB, password: fixture.password },
    });
    const token = (await login.json()).data.accessToken;

    const attempt = await request.post(`${API_URL}/api/registrations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { expoRef: fixture.expo.id, sessionRef: fixture.sessions.full.id, bookmarked: true },
    });

    expect(attempt.status()).toBeGreaterThanOrEqual(400);
    expect((await attempt.json()).message).toMatch(/full|capacity|no seats/i);

    await card.getByRole('button', { name: 'Bookmarked', exact: true }).click();
  });
});
