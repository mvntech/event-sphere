import { test, expect, type Page } from '@playwright/test';
import { fixture, signIn } from '../support/fixture';

function booth(page: Page, label: string, status?: 'available' | 'reserved' | 'assigned') {
  const name = status ? `Booth ${label}, ${status}` : new RegExp(`^Booth ${label},`);
  return page.getByRole('button', { name, exact: typeof name === 'string' });
}

async function openFloorPlan(page: Page, email: string) {
  await signIn(page, email);
  await page.goto('/exhibitor/booth');
  await expect(page.getByText('Live — updates appear automatically')).toBeVisible();
}

test.describe('booth reservation', () => {
  test('a second exhibitor sees a booth taken, live, without reloading', async ({ browser }) => {
    const watcherCtx = await browser.newContext();
    const claimerCtx = await browser.newContext();

    const watcher = await watcherCtx.newPage();
    const claimer = await claimerCtx.newPage();

    const target = fixture.booths[2].label;

    try {
      await openFloorPlan(watcher, fixture.accounts.exhibitorA);
      await openFloorPlan(claimer, fixture.accounts.exhibitorB);

      await expect(booth(watcher, target, 'available')).toBeVisible();

      const watcherCalls: string[] = [];
      watcher.on('request', (r) => {
        if (r.url().includes('/api/')) watcherCalls.push(`${r.method()} ${new URL(r.url()).pathname}`);
      });

      await booth(claimer, target).click();
      await claimer.getByRole('button', { name: 'Reserve this booth' }).click();
      await expect(claimer.getByRole('button', { name: 'Release this booth' })).toBeVisible();

      await expect(booth(watcher, target, 'reserved')).toBeVisible();
      await expect(watcher.getByText('Lin Optics').first()).toBeVisible();

      expect(
        watcherCalls.filter((c) => c.includes('/booths')),
        `the watcher refetched instead of receiving a broadcast: ${watcherCalls.join(', ')}`
      ).toHaveLength(0);

      await booth(watcher, target).click();
      await expect(watcher.getByRole('button', { name: 'Reserve this booth' })).toHaveCount(0);
    } finally {
      await claimer
        .getByRole('button', { name: 'Release this booth' })
        .click({ timeout: 5000 })
        .catch(() => {});
      await watcherCtx.close();
      await claimerCtx.close();
    }
  });

  test('an exhibitor holds one booth per expo, and releasing frees it', async ({ page }) => {
    await openFloorPlan(page, fixture.accounts.exhibitorA);

    const first = fixture.booths[0].label;
    const second = fixture.booths[1].label;

    await booth(page, first).click();
    await page.getByRole('button', { name: 'Reserve this booth' }).click();
    await expect(page.getByRole('button', { name: 'Release this booth' })).toBeVisible();
    await expect(booth(page, first, 'reserved')).toBeVisible();

    await booth(page, second).click();
    await page.getByRole('button', { name: 'Reserve this booth' }).click();
    await expect(page.getByText(/already hold booth/i)).toBeVisible();
    await expect(booth(page, second, 'available')).toBeVisible();

    await booth(page, first).click();
    await page.getByRole('button', { name: 'Release this booth' }).click();
    await expect(booth(page, first, 'available')).toBeVisible();
  });
});
