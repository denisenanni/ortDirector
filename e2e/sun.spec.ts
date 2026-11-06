// Sun hours: the garden's position, an obstacle drawn on the map, the zone's
// hours month by month and the offer to change its exposure, then the map in
// sun mode. Same fixed date and empty garden as the other specs.
import { expect, test, type Locator, type Page } from '@playwright/test';

const onMap = (page: Page, text: string | RegExp) => page.getByText(text, { exact: true }).last();

async function clickAt(page: Page, l: Locator) {
  const b = (await l.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  page.on('dialog', (d) => d.accept());
});

test('a house south of a bed takes its sun, and the app offers to change the zone', async ({ page }) => {
  // Turin, typed by hand.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Imposta la posizione' }).click();
  await page.getByLabel('Latitudine', { exact: true }).fill('45,07');
  await page.getByLabel('Longitudine', { exact: true }).fill('7,69');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText(/Posizione: 45,07, 7,69/)).toBeVisible();

  // A 2 x 1 m bed in full sun, alone on the map.
  await page.goto('/map');
  await page.getByRole('button', { name: 'Modifica la mappa' }).click();
  await page.getByRole('button', { name: /Nuova zona$/ }).click();
  await page.getByPlaceholder(/Es\. Aiuola/).fill('Orto');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole('button', { name: 'Fine' }).click();
  await clickAt(page, onMap(page, 'Orto'));
  await expect(page).toHaveURL(/\/zone\/\d+$/);
  await expect(page.getByText(/ore al giorno da aprile a settembre: pieno sole/)).toBeVisible();
  await expect(page.getByText(/la stima dice/)).toHaveCount(0);
  const zone = page.url();

  // A tall house right south of it (north is up, south is down the map).
  await page.goto('/obstacle/edit?x=0&y=4.6');
  await page.getByRole('button', { name: /Casa$/ }).click();
  await page.getByLabel('Altezza', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Salva' }).click();

  await page.goto(zone);
  await expect(page.getByText(/la stima dice (mezz’ombra|ombra)/)).toBeVisible();
  await page.getByRole('button', { name: /Segna (mezz’ombra|ombra)$/ }).click();
  await expect(page.getByText(/la stima dice/)).toHaveCount(0);

  // The map in sun mode: hours on the zone, the time moves in 15-minute steps.
  await page.goto('/map');
  await page.getByRole('button', { name: 'Mostra il sole' }).click();
  await expect(onMap(page, /h di sole$/)).toBeVisible();
  await expect(page.getByText('Ora 12:00')).toBeVisible();
  await page.getByRole('button', { name: 'Dopo' }).click();
  await expect(page.getByText('Ora 12:15')).toBeVisible();
  await expect(page.locator('polygon').first()).toBeVisible();
});
