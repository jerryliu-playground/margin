import { expect, test } from '@playwright/test';

test('agent server is up with the mock model', async ({ request }) => {
  const res = await request.get('http://127.0.0.1:18787/health');
  expect(res.ok()).toBe(true);
});
