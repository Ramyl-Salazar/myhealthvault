import { expect, test } from '@playwright/test';

test('previously visited records and emergency card remain available offline', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText(/Possible duplicate: Glucophage, Metformin/)).toBeVisible();
  await page.goto('/timeline');
  await expect(page.getByText('Metformin', { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('mhv-query-cache')?.includes('Metformin'))).toBe(true);
  await page.goto('/emergency');
  await expect(page.getByRole('heading', { name: /Emergency/ })).toBeVisible();
  await context.setOffline(true);
  await page.goto('/timeline');
  await expect(page.getByText('Metformin', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('You are offline. Records are read-only until you reconnect.')).toBeVisible();
  await page.goto('/emergency');
  await expect(page.getByRole('heading', { name: /Emergency/ })).toBeVisible();
  await page.goto('/add');
  await page.getByRole('button', { name: 'Enter by hand' }).click();
  await expect(page.getByRole('button', { name: 'Save record' })).toBeDisabled();
});
