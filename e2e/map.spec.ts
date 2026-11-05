// The garden map: draw a zone, move and resize it with the mouse, tap it to
// reach its plants. Same fixed date and empty garden as garden.spec.ts.
import { expect, test, type Locator, type Page } from '@playwright/test';

/** The map draws with pointer events off and reads the touches itself: click where the thing is. */
/** Text on the map: each label is drawn twice, outline under fill; the fill is the last. */
const onMap = (page: Page, text: string) => page.getByText(text, { exact: true }).last();

async function clickAt(page: Page, l: Locator) {
  const b = (await l.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  page.on('dialog', (d) => d.accept());
});

test('a zone drawn on the map moves, resizes, and opens its plants', async ({ page }) => {
  // A zone that stays off the map, from the Plants tab as before.
  await page.goto('/zone/edit');
  await page.getByPlaceholder(/Es\. Aiuola/).fill('Davanzale');
  await page.getByRole('button', { name: 'Salva' }).click();

  await page.goto('/map');
  await expect(page.getByText(/Ancora vuota/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Davanzale · 0$/ })).toBeVisible();

  // A new zone from the map, measured by hand.
  await page.getByRole('button', { name: 'Modifica la mappa' }).click();
  await page.getByRole('button', { name: /Nuova zona$/ }).click();
  await page.getByPlaceholder(/Es\. Aiuola/).fill('Orto');
  await page.getByLabel('Larghezza', { exact: true }).fill('3');
  await page.getByLabel('Lunghezza', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(onMap(page, '3 × 2 m')).toBeVisible();

  // Drag the corner handle out: the zone grows.
  await clickAt(page, onMap(page, 'Orto'));
  await expect(page.getByText(/Trascina per spostare/)).toBeVisible();
  // The zone's centre is under its name, the resize handle 1.5 x 1 m away from it.
  const centre = (await onMap(page, '3 × 2 m').boundingBox())!;
  const handle = (await page.locator('circle').first().boundingBox())!;
  const cx = centre.x + centre.width / 2;
  const hx = handle.x + handle.width / 2;
  const hy = handle.y + handle.height / 2;
  const scale = (hx - cx) / 1.5;
  const cy = hy - scale;
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + 0.5 * scale, hy + 0.5 * scale, { steps: 8 });
  await page.mouse.up();
  await expect(onMap(page, '3,5 × 2,5 m')).toBeVisible();

  // Drag the body: it moves, keeping its size.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy - 30, { steps: 8 });
  await page.mouse.up();
  await expect(onMap(page, '3,5 × 2,5 m')).toBeVisible();

  // Still there after closing and opening the app, then a tap opens it.
  await page.reload();
  await clickAt(page, onMap(page, 'Orto'));
  await expect(page).toHaveURL(/\/zone\/\d+$/);
  await expect(page.getByText('Nessuna pianta in questa zona.')).toBeVisible();
  await expect(page.getByText('3,5 × 2,5 m')).toBeVisible();

  // The form shows the measures the mouse made.
  await page.getByRole('button', { name: 'Modifica zona' }).click();
  await expect(page.getByLabel('Larghezza', { exact: true })).toHaveValue('3,5');
  await page.getByRole('button', { name: /^No$/ }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Fuori mappa', { exact: true })).toBeVisible();
  await page.goto('/map');
  await expect(page.getByRole('button', { name: /Orto · 0$/ })).toBeVisible();
});
