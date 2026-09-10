import { test, expect, type Page } from '@playwright/test';
import { fixture, signIn } from '../support/fixture';

const bubble = (page: Page, text: string) => page.getByRole('paragraph').filter({ hasText: text });

test.describe('organizer inbox', () => {
  test('an exhibitor opens a support thread and the organizer reads and answers it', async ({
    browser,
  }) => {
    test.setTimeout(90_000);

    const exhibitorCtx = await browser.newContext();
    const organizerCtx = await browser.newContext();

    const exhibitor = await exhibitorCtx.newPage();
    const organizer = await organizerCtx.newPage();

    const stamp = Date.now() % 100_000;
    const question = `Is there three-phase power at the stand? (${stamp})`;
    const answer = `Yes — ask the duty electrician on arrival. (${stamp})`;

    try {
      await signIn(exhibitor, fixture.accounts.exhibitorA);
      await exhibitor.goto('/exhibitor/messages');

      await exhibitor.getByRole('button', { name: 'New message' }).first().click();

      const dialog = exhibitor.getByRole('dialog');
      await expect(dialog.getByText('New message')).toBeVisible();

      await dialog.getByRole('button', { name: /Ada Reyes/ }).click();
      await dialog.getByLabel('Message').fill(question);
      await dialog.getByRole('button', { name: 'Send message' }).click();

      await expect(bubble(exhibitor, question)).toBeVisible();

      await signIn(organizer, fixture.accounts.organizer);

      await organizer.getByRole('link', { name: 'Messages' }).click();
      await expect(organizer).toHaveURL(/\/organizer\/messages/);

      await organizer.getByText(/Dan Okafor/).first().click();
      await expect(bubble(organizer, question)).toBeVisible();

      await expect(organizer.getByRole('button', { name: 'New message' })).toHaveCount(0);

      await organizer.getByPlaceholder('Write a message…').fill(answer);
      await organizer.getByRole('button', { name: 'Send message' }).click();
      await expect(bubble(organizer, answer)).toBeVisible();

      await expect(bubble(exhibitor, answer)).toBeVisible({ timeout: 15_000 });
    } finally {
      await exhibitorCtx.close();
      await organizerCtx.close();
    }
  });
});
