import { test } from '@playwright/test';

import { seedFixture } from '../support/seed';

test('seed the fixture database', () => {
  test.setTimeout(90_000);

  seedFixture();
});
