// Whole flows as you'd do them on the phone. Every test starts from an empty
// garden (each test gets its own browser storage) on Monday 15 June 2026, so
// summer intervals apply and dates don't depend on when the tests run.
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  page.on('dialog', (d) => d.accept());
});

/** Adds a catalog plant from the form and waits for its page. Returns its id. */
async function addPlant(
  page: Page,
  name: string,
  { stage = 'A dimora in terra', since = '30 giorni fa', zone, covered = false }: { stage?: string; since?: string; zone?: string; covered?: boolean } = {},
): Promise<string> {
  await page.goto('/plant/edit');
  await page.getByPlaceholder('Cerca: pomodoro').fill(name);
  await page.getByRole('button', { name, exact: true }).click();
  await page.getByRole('button', { name: stage, exact: true }).click();
  await page.getByRole('button', { name: since, exact: true }).click();
  if (zone) await page.getByRole('button', { name: new RegExp(`${zone}$`) }).click();
  if (covered) await page.getByRole('checkbox', { name: /^Al coperto/ }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.waitForURL(/\/plant\/\d+$/);
  return page.url().split('/').pop()!;
}

/** A task row in a list: the innermost block with its tick and every given text (plant, "Oggi", "Fatto oggi"…). */
function row(page: Page, title: string, ...texts: string[]) {
  let rows = page
    .locator('div')
    .filter({ has: page.getByRole('checkbox', { name: new RegExp(`^(Segna come fatto|Fatto): ${title}(\\.|$)`) }) });
  for (const t of texts) rows = rows.filter({ hasText: t });
  return rows.last();
}

const section = (page: Page, name: string) => page.getByText(name, { exact: true });

test('a plant from the catalog shows up in Oggi; ticking it moves it on, unticking brings it back', async ({ page }) => {
  await addPlant(page, 'Basilico');
  await page.goto('/');
  const water = row(page, 'Annaffiare', 'Basilico');
  await expect(water).toContainText('Oggi');
  await water.getByRole('checkbox').click();
  await expect(row(page, 'Annaffiare', 'Basilico', 'Fatto oggi')).toBeVisible();
  await expect(row(page, 'Annaffiare', 'Basilico', 'Domani')).toBeVisible();

  // Still there after closing and opening the app.
  await page.reload();
  const done = row(page, 'Annaffiare', 'Basilico', 'Fatto oggi');
  await expect(done).toBeVisible();
  await done.getByRole('checkbox').click();
  await expect(row(page, 'Annaffiare', 'Basilico')).toContainText('Oggi');
  await expect(page.getByText('Fatto oggi')).toHaveCount(0);
});

test('rain waters the plants outdoors, not the ones under cover, and can be undone', async ({ page }) => {
  await addPlant(page, 'Basilico');
  await addPlant(page, 'Prezzemolo', { covered: true });
  await page.goto('/');
  await expect(row(page, 'Annaffiare', 'Basilico')).toContainText('Oggi');
  await expect(row(page, 'Annaffiare', 'Prezzemolo')).toContainText('Oggi');

  await page.getByRole('button', { name: /Ha piovuto/ }).click();
  await expect(page.getByText('Pioggia segnata oggi')).toBeVisible();
  await expect(row(page, 'Annaffiare', 'Basilico')).toContainText('Domani');
  await expect(row(page, 'Annaffiare', 'Prezzemolo')).toContainText('Oggi');

  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.getByRole('button', { name: /Ha piovuto/ })).toBeVisible();
  await expect(row(page, 'Annaffiare', 'Basilico')).toContainText('Oggi');
});

test('a sown tomato waits for its transplant, then gets the plan', async ({ page }) => {
  const id = await addPlant(page, 'Pomodoro', { stage: 'Seminata', since: '30 giorni fa' });
  await expect(page.getByText('Pronta da trapiantare')).toBeVisible();

  await page.getByRole('button', { name: /Segna il trapianto/ }).click();
  await page.getByRole('checkbox', { name: /Raccolta/ }).click(); // left out
  await page.getByRole('button', { name: /Segna il trapianto/ }).click();
  await page.waitForURL(new RegExp(`/plant/${id}$`));

  await expect(page.getByText('Pronta da trapiantare')).toHaveCount(0);
  await expect(page.getByText('Annaffiare (attecchimento)')).toBeVisible();
  await expect(page.getByText('Mettere il tutore')).toBeVisible();
  await expect(page.getByText('Togliere le femminelle')).toBeVisible();
  await expect(page.getByText('Raccolta', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Messa a dimora')).toBeVisible();
});

test('basil in the ground goes into a pot indoors and gets the care after the move', async ({ page }) => {
  const id = await addPlant(page, 'Basilico', { since: '30 giorni fa' });
  await page.getByRole('button', { name: /Rinvasa o sposta/ }).click();
  await page.getByText('Dove va', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: /^Al coperto/ }).click();
  await page.getByRole('checkbox', { name: /Controllare che non soffra/ }).click(); // left out
  await page.getByRole('button', { name: /Segna lo spostamento/ }).click();
  await page.waitForURL(new RegExp(`/plant/${id}$`));

  await expect(page.getByText('Annaffiare bene dopo il rinvaso')).toBeVisible();
  await expect(page.getByText('Controllare il terriccio (annaffiare solo se asciutto)')).toBeVisible();
  await expect(page.getByText(/Controllare che non soffra/)).toHaveCount(0);
  await expect(page.getByText('Messa in vaso')).toBeVisible();
  await expect(page.getByText(/Nel vaso dal/)).toBeVisible();

  // Editing the plant can't flip it back to the ground: that's a move too.
  await page.getByRole('button', { name: 'Modifica pianta' }).click();
  await page.waitForURL(/\/plant\/edit/);
  await expect(page.getByText('In vaso (vaso medio)')).toBeVisible();
  await expect(page.getByRole('button', { name: /In terra$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Rinvasa o sposta/ })).toBeVisible();
});

test('a zone in the shade warns about a plant that wants full sun', async ({ page }) => {
  await page.goto('/plants');
  await page.getByRole('button', { name: /Nuova zona$/ }).click();
  await page.getByPlaceholder('Es. Aiuola nord').fill('Sottoscala');
  await page.getByRole('button', { name: /Ombra$/ }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  // Saved once Piante shows it; leaving earlier could cut the write short.
  await expect(page.getByText('Sottoscala')).toBeVisible();
  await addPlant(page, 'Pomodoro', { zone: 'Sottoscala' });

  await page.goto('/plants');
  await expect(page.getByText('Sottoscala')).toBeVisible();
  await expect(page.getByText(/Qui prende meno sole di quanto le serve/)).toBeVisible();
});

test('a task you add by hand can be put off to tomorrow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nuova attività' }).click();
  await page.getByRole('button', { name: /Trattamento/ }).click();
  await page.getByRole('textbox').first().fill('Rame sulle viti');
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByText('Rame sulle viti')).toBeVisible();
  await expect(section(page, 'Da fare oggi')).toBeVisible();

  await page.getByText('Rame sulle viti').click();
  await page.getByRole('button', { name: 'Rimanda a domani' }).click();
  await page.waitForURL(/\/$/);
  await expect(row(page, 'Rame sulle viti', 'Domani')).toBeVisible();
  await expect(section(page, 'Da fare oggi')).toHaveCount(0);
});

test('a backup brings the garden to another phone', async ({ page, browser }) => {
  await addPlant(page, 'Basilico');
  await addPlant(page, 'Pomodoro', { stage: 'Seminata' });
  await page.goto('/settings');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Esporta backup' }).click(),
  ]);
  const file = await download.path();
  expect(download.suggestedFilename()).toBe('ortdirector-backup-2026-06-15.json');

  // A new browser profile is an empty phone.
  const other = await browser.newPage({ locale: 'it-IT' });
  await other.clock.setFixedTime(new Date('2026-06-15T10:00:00'));
  other.on('dialog', (d) => d.accept());
  await other.goto('/plants');
  await expect(other.getByText('Nessuna pianta')).toBeVisible();
  await other.goto('/settings');
  const [chooser] = await Promise.all([
    other.waitForEvent('filechooser'),
    other.getByRole('button', { name: 'Importa backup' }).click(),
  ]);
  await chooser.setFiles(file);
  await expect(other.getByText(/Backup importato: 2 piante/)).toBeVisible();

  await other.goto('/');
  await expect(row(other, 'Annaffiare', 'Basilico')).toContainText('Oggi');
  await expect(row(other, 'Pronta da trapiantare', 'Pomodoro')).toBeVisible();
  await other.close();
});

test('the plant’s watering is changed from the plant, not from the task', async ({ page }) => {
  const id = await addPlant(page, 'Basilico');
  await page.goto('/');
  await row(page, 'Annaffiare', 'Basilico').getByText('Annaffiare').click();
  await expect(page.getByText('Ripeti', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tipo', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cambia dalla pianta' }).click();
  await page.waitForURL(new RegExp(`/plant/edit\\?id=${id}$`));
  await expect(page.getByText('Irrigazione da maggio a settembre')).toBeVisible();
});

test('a zone created while moving a plant is picked for it', async ({ page }) => {
  const id = await addPlant(page, 'Basilico');
  await page.getByRole('button', { name: /Rinvasa o sposta/ }).click();
  await page.getByRole('button', { name: /Nuova zona$/ }).click();
  await page.getByPlaceholder(/Aiuola nord/).fill('Balcone');
  await page.getByRole('button', { name: 'Salva' }).click();
  await page.waitForURL(/\/plant\/move/);
  await expect(page.getByRole('button', { name: /Balcone$/ })).toBeVisible();
  await page.getByRole('button', { name: /Segna lo spostamento/ }).click();
  await page.waitForURL(new RegExp(`/plant/${id}$`));
  await expect(page.getByText('Balcone').first()).toBeVisible();
});
