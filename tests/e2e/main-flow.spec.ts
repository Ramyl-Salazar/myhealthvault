import { expect, test } from '@playwright/test';

test('demo record can be scanned, shared, verified, and revoked', async ({ page, browser }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByText(/Possible duplicate: Glucophage, Metformin/)).toBeVisible();

  await page.getByRole('link', { name: 'Scan a document' }).click();
  await page.getByRole('button', { name: 'Prescription sample' }).click();
  await page.getByRole('button', { name: 'Save record' }).first().click();
  await expect(page.getByRole('button', { name: 'Save record' })).toHaveCount(2);
  await page.getByRole('link', { name: 'Timeline', exact: true }).click();
  await page.getByRole('link', { name: /Metformin.*14 Nov 2026/ }).click({ timeout: 10_000 });
  await expect(page.getByText('Supported by a document')).toBeVisible();
  await expect(page.getByText('14 Nov 2026')).toBeVisible();
  const scannedRecordUrl = page.url();

  await page.getByRole('link', { name: 'Share', exact: true }).click();
  await page.getByRole('link', { name: 'Make a share link' }).click();
  await page.getByLabel('How long it lasts').selectOption('60');
  await page.getByRole('button', { name: 'Create link' }).click();
  const sharedUrl = await page.getByLabel('Share link').inputValue();
  const shareDetailUrl = page.url();
  const clinician = await browser.newContext({ viewport: page.viewportSize() ?? { width: 360, height: 800 } });
  const clinicianPage = await clinician.newPage();
  await clinicianPage.goto(new URL(new URL(sharedUrl).pathname, page.url()).toString());
  const scannedOnShare = clinicianPage.getByRole('listitem').filter({ hasText: 'Metformin' }).filter({ hasText: '14 Nov 2026' });
  await expect(scannedOnShare).toBeVisible();
  await scannedOnShare.getByRole('button', { name: 'Mark as verified' }).click();
  await clinicianPage.getByLabel('Your name').fill('Demo Clinician');
  await clinicianPage.getByLabel('Licence number').fill('DEMO-123');
  await clinicianPage.getByRole('button', { name: 'Verify record' }).click();
  await expect(clinicianPage.getByText('Verified by a clinician: Demo Clinician')).toBeVisible();

  await expect(page.getByText('Viewed', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Verified a record', { exact: true })).toHaveCount(1);
  await page.goto(scannedRecordUrl);
  await expect(page.getByText('Verified by a clinician')).toBeVisible();
  await page.goto(shareDetailUrl);
  await page.getByRole('button', { name: 'Stop sharing' }).click();
  await clinicianPage.reload();
  await expect(clinicianPage.getByText('This link has ended')).toBeVisible();
  await clinician.close();
});
