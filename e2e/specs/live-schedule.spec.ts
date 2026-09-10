import { test, expect } from '@playwright/test';
import { fixture, signIn } from '../support/fixture';

const ORIGINAL_ROOM = 'Room 1';

const IDLE_WINDOW_MS = 3_000;

test.describe('live schedule', () => {
  test('an organizer moving a session reaches an attendee who never touches the page', async ({
    browser,
  }) => {
    const attendeeCtx = await browser.newContext();
    const organizerCtx = await browser.newContext();

    const attendee = await attendeeCtx.newPage();
    const organizer = await organizerCtx.newPage();

    const newRoom = `Hall Z ${Date.now() % 10_000}`;
    const sessionTitle = fixture.sessions.open.title;

    try {
      await signIn(attendee, fixture.accounts.attendee);
      await attendee.goto(`/attendee/expos/${fixture.expo.id}`);

      await expect(attendee.getByText(sessionTitle).first()).toBeVisible();
      await expect(attendee.getByText(ORIGINAL_ROOM).first()).toBeVisible();

      const sessionCalls: string[] = [];
      attendee.on('request', (r) => {
        const url = new URL(r.url());
        if (url.pathname.includes('/api/sessions')) sessionCalls.push(`${r.method()} ${url.pathname}`);
      });

      await attendee.waitForTimeout(IDLE_WINDOW_MS);
      expect(
        sessionCalls,
        `the attendee refetched the schedule while idle, so a later change would prove nothing: ${sessionCalls.join(', ')}`
      ).toHaveLength(0);

      await signIn(organizer, fixture.accounts.organizer);
      await organizer.goto(`/organizer/schedule?expo=${fixture.expo.id}`);

      await organizer.getByRole('button', { name: `Edit ${sessionTitle}` }).click();
      await organizer.getByLabel('Location').fill(newRoom);
      await organizer.getByRole('button', { name: 'Save changes' }).click();

      await expect(attendee.getByText(newRoom).first()).toBeVisible({ timeout: 15_000 });
      await expect(attendee.getByText(ORIGINAL_ROOM)).toHaveCount(0);

      expect(
        sessionCalls.length,
        'the room changed without the attendee refetching, which is not how useLiveSchedule works'
      ).toBeGreaterThan(0);
    } finally {
      /*
       * Put the room back, so this file can run twice against one seed — the
       * same courtesy `booth-reservation.spec.ts` pays by releasing its booth.
       */
      await organizer
        .getByRole('button', { name: `Edit ${sessionTitle}` })
        .click({ timeout: 5_000 })
        .then(async () => {
          await organizer.getByLabel('Location').fill(ORIGINAL_ROOM);
          await organizer.getByRole('button', { name: 'Save changes' }).click();
        })
        .catch(() => {});

      await attendeeCtx.close();
      await organizerCtx.close();
    }
  });
});
