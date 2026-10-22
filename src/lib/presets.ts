import { cat, days, language, tr } from './i18n.ts';
import { CATALOG_EN } from './catalog-en.ts';
import { customEnglish, customEntries, customFor } from './custom.ts';
import { PLANT_KINDS } from './kinds.ts';
import type { Size, Sun, TaskType } from './types';

export interface PlantPreset {
  name: string;
  sun: Sun;
  /** Typical summer watering interval in open ground. Pots dry out faster. */
  waterEveryDays: number;
  tip: string;
}

// Rough guidelines for a temperate Italian garden. Users can override every
// value per plant; these only prefill the form.
export const PLANT_PRESETS: PlantPreset[] = [
  { name: 'Pomodoro', sun: 'full', waterEveryDays: 2, tip: 'Acqua alla base, mai sulle foglie. Togli le femminelle ogni settimana.' },
  { name: 'Zucchina', sun: 'full', waterEveryDays: 2, tip: 'Molta acqua quando fruttifica. Raccogli spesso, a 15-20 cm.' },
  { name: 'Melanzana', sun: 'full', waterEveryDays: 2, tip: 'Ama il caldo. Pacciama per tenere il terreno umido.' },
  { name: 'Peperone', sun: 'full', waterEveryDays: 2, tip: 'Terreno sempre leggermente umido, mai fradicio.' },
  { name: 'Peperoncino', sun: 'full', waterEveryDays: 3, tip: 'Un po’ di stress idrico lo rende più piccante.' },
  { name: 'Cetriolo', sun: 'full', waterEveryDays: 2, tip: 'Irrigazione regolare, altrimenti i frutti diventano amari.' },
  { name: 'Fagiolino', sun: 'full', waterEveryDays: 3, tip: 'Non bagnare le foglie. Raccogli giovani.' },
  { name: 'Lattuga', sun: 'partial', waterEveryDays: 2, tip: 'Con il caldo va in seme: meglio mezz’ombra d’estate.' },
  { name: 'Rucola', sun: 'partial', waterEveryDays: 2, tip: 'Cresce in fretta, semina scalare ogni 2-3 settimane.' },
  { name: 'Spinacio', sun: 'partial', waterEveryDays: 3, tip: 'Coltura fresca: primavera e autunno.' },
  { name: 'Finocchio', sun: 'full', waterEveryDays: 2, tip: 'Teme la siccità: con poca acqua va in seme. Rincalza il grumolo per averlo bianco e tenero.' },
  { name: 'Indivia riccia', sun: 'full', waterEveryDays: 3, tip: 'Lega le foglie 2 settimane prima della raccolta, con il cespo asciutto, per imbianchire il cuore.' },
  { name: 'Scarola', sun: 'full', waterEveryDays: 3, tip: 'Lega le foglie 2 settimane prima della raccolta, con il cespo asciutto, per imbianchire il cuore.' },
  { name: 'Valerianella', sun: 'partial', waterEveryDays: 3, tip: 'Il songino: semina a dimora da fine agosto, resiste al gelo. Raccogli la rosetta intera.' },
  { name: 'Cicoria da taglio', sun: 'full', waterEveryDays: 3, tip: 'Taglia a 2-3 cm da terra: ricaccia più volte.' },
  { name: 'Radicchio di Chioggia', sun: 'full', waterEveryDays: 3, tip: 'Forma la palla con il fresco. Evita i ristagni, marcisce facilmente.' },
  { name: 'Radicchio di Treviso tardivo', sun: 'full', waterEveryDays: 3, tip: 'Dopo le prime brinate si espianta e si forza al buio in acqua per 2-3 settimane.' },
  { name: 'Radicchio di Castelfranco', sun: 'full', waterEveryDays: 3, tip: 'Il freddo lo colora: raccogli dopo le prime gelate.' },
  { name: 'Cavolfiore', sun: 'full', waterEveryDays: 3, tip: 'Quando si vede la testa, piega le foglie sopra per tenerla bianca.' },
  { name: 'Broccolo', sun: 'full', waterEveryDays: 3, tip: 'Raccogli la testa centrale prima che fiorisca: poi fa i getti laterali.' },
  { name: 'Cavolo cappuccio', sun: 'full', waterEveryDays: 3, tip: 'Irrigazione regolare, altrimenti la testa si spacca.' },
  { name: 'Verza', sun: 'full', waterEveryDays: 3, tip: 'Il gelo la rende più dolce. Controlla la cavolaia sotto le foglie.' },
  { name: 'Cavolo nero', sun: 'full', waterEveryDays: 4, tip: 'Raccogli le foglie basse una alla volta: produce tutto l’inverno.' },
  { name: 'Cavolo di Bruxelles', sun: 'full', waterEveryDays: 3, tip: 'Rincalza e togli le foglie basse ingiallite. Il gelo migliora il sapore.' },
  { name: 'Cime di rapa', sun: 'full', waterEveryDays: 3, tip: 'Semina a dimora a fine estate. Raccogli prima che i fiori si aprano.' },
  { name: 'Carota', sun: 'full', waterEveryDays: 3, tip: 'Terreno sciolto senza sassi. Dirada le piantine.' },
  { name: 'Cipolla', sun: 'full', waterEveryDays: 4, tip: 'Sospendi l’acqua quando le foglie ingialliscono.' },
  { name: 'Aglio', sun: 'full', waterEveryDays: 7, tip: 'Poca acqua, teme i ristagni.' },
  { name: 'Fragola', sun: 'full', waterEveryDays: 2, tip: 'Pacciama con paglia per tenere puliti i frutti.' },
  { name: 'Basilico', sun: 'full', waterEveryDays: 1, tip: 'Cima i fiori per farlo cespugliare.' },
  { name: 'Prezzemolo', sun: 'partial', waterEveryDays: 2, tip: 'Germina lentamente, ha bisogno di umidità costante.' },
  { name: 'Menta', sun: 'partial', waterEveryDays: 2, tip: 'Invasiva: meglio in vaso.' },
  { name: 'Rosmarino', sun: 'full', waterEveryDays: 7, tip: 'Resiste alla siccità, teme l’acqua stagnante.' },
  { name: 'Salvia', sun: 'full', waterEveryDays: 5, tip: 'Pota dopo la fioritura per mantenerla compatta.' },
  { name: 'Lavanda', sun: 'full', waterEveryDays: 10, tip: 'Pochissima acqua. Pota a fine estate, mai sul legno vecchio.' },
  { name: 'Timo', sun: 'full', waterEveryDays: 7, tip: 'Terreno povero e drenato.' },
  { name: 'Ortensia', sun: 'shade', waterEveryDays: 2, tip: 'Molta acqua, possibilmente piovana. Teme il sole pomeridiano.' },
  { name: 'Rosa', sun: 'full', waterEveryDays: 3, tip: 'Pota a fine inverno. Controlla afidi e oidio.' },
  { name: 'Limone (vaso)', sun: 'full', waterEveryDays: 3, tip: 'Lascia asciugare i primi cm di terra tra un’irrigazione e l’altra.' },
  { name: 'Litchi', sun: 'full', waterEveryDays: 3, tip: 'Subtropicale: sotto i -2 °C soffre, da giovane già a 0 °C. Terreno sempre umido ma drenato, acqua poco calcarea e concime leggero: le radici patiscono il sale.' },
  { name: 'Avocado', sun: 'full', waterEveryDays: 5, tip: 'Teme i ristagni più della siccità: annaffia a fondo e lascia asciugare i primi cm. Pacciama, le radici sono superficiali. Sotto i -2 °C va protetto.' },
  { name: 'Leonotis (klip dagga)', sun: 'full', waterEveryDays: 7, tip: 'Resiste alla siccità e fiorisce da fine estate all’autunno. Sotto i -5 °C la parte aerea secca ma ricaccia dalla base: pacciama le radici d’inverno.' },
];

// Getters, so the labels follow the language chosen at start-up.
export const SUN_LABEL: Record<Sun, string> = {
  get full() { return tr('Pieno sole', 'Full sun'); },
  get partial() { return tr('Mezz’ombra', 'Part shade'); },
  get shade() { return tr('Ombra', 'Shade'); },
};

export const PLANT_SIZE_LABEL: Record<Size, string> = {
  get small() { return tr('Piccola o giovane', 'Small or young'); },
  get medium() { return tr('Media', 'Medium'); },
  get large() { return tr('Grande, adulta', 'Large, mature'); },
};

export const POT_SIZE_LABEL: Record<Size, string> = {
  get small() { return tr('Piccolo, fino a 20 cm', 'Small, up to 20 cm'); },
  get medium() { return tr('Medio, 20-40 cm', 'Medium, 20-40 cm'); },
  get large() { return tr('Grande, oltre 40 cm', 'Large, over 40 cm'); },
};

/** "Vaso piccolo", for the plant's page. */
export const POT_LABEL: Record<Size, string> = {
  get small() { return tr('Vaso piccolo', 'Small pot'); },
  get medium() { return tr('Vaso medio', 'Medium pot'); },
  get large() { return tr('Vaso grande', 'Large pot'); },
};

export const SUN_ICON: Record<Sun, string> = {
  full: '☀️',
  partial: '⛅',
  shade: '☁️',
};

export const TASK_LABEL: Record<TaskType, string> = {
  get water() { return tr('Annaffiare', 'Water'); },
  get check() { return tr('Controllo', 'Check'); },
  get prune() { return tr('Potatura', 'Prune'); },
  get fertilize() { return tr('Concimazione', 'Feed'); },
  get treat() { return tr('Trattamento', 'Treat'); },
  get harvest() { return tr('Raccolta', 'Harvest'); },
  get transplant() { return tr('Trapianto', 'Transplant'); },
  get other() { return tr('Altro', 'Other'); },
};

export const TASK_ICON: Record<TaskType, string> = {
  water: '💧',
  check: '🔍',
  prune: '✂️',
  fertilize: '🧪',
  treat: '🐛',
  harvest: '🧺',
  transplant: '🌱',
  other: '📝',
};

const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short month names, January first, in the app's language. */
export function monthShort(): string[] {
  return language() === 'en' ? MONTHS_EN : MONTHS_IT;
}

/** "apr–set", "feb", "mar, nov–gen": months as runs of consecutive months. */
export function monthsLabel(months: number[]): string {
  const set = new Set(months);
  if (set.size === 12) return tr('tutto l’anno', 'all year');
  const names = monthShort();
  // Start right after a missing month so a run across New Year stays whole.
  let start = 1;
  while (set.has(start) && start <= 12) start++;
  const runs: [number, number][] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((start - 1 + i) % 12) + 1;
    if (!set.has(m)) continue;
    const last = runs[runs.length - 1];
    if (last && last[1] % 12 === m - 1) last[1] = m;
    else runs.push([m, m]);
  }
  return runs
    .map(([a, b]) => (a === b ? names[a - 1] : `${names[a - 1]}–${names[b - 1]}`))
    .join(', ');
}

/** "ogni 21 giorni, apr–set fino al 3 nov", for a task's repeat rule. Empty for one-off tasks. */
export function repeatLabel(t: {
  repeatDays: number | null;
  yearly: boolean;
  months: number[] | null;
  coldRepeatDays?: number | null;
}): string {
  const season = t.months?.length ? monthsLabel(t.months) : '';
  const yearly = tr('ogni anno', 'every year');
  if (t.yearly) return season ? `${yearly}, ${season}` : yearly;
  if (!t.repeatDays) return '';
  let every = everyDays(t.repeatDays);
  if (t.coldRepeatDays && t.coldRepeatDays !== t.repeatDays) {
    every += ` (${tr('ott–apr', 'Oct–Apr')} ${everyDays(t.coldRepeatDays)})`;
  }
  return season ? `${every}, ${season}` : every;
}

/** "ogni giorno", "ogni 3 giorni", "every day", "every 3 days". */
export function everyDays(n: number): string {
  if (n === 1) return tr('ogni giorno', 'every day');
  return tr(`ogni ${days(n)}`, `every ${days(n)}`);
}

/** Catalog plants that live for years; every other catalog plant is an annual crop. */
const PERENNIALS = new Set([
  'Fragola', 'Menta', 'Rosmarino', 'Salvia', 'Lavanda', 'Timo', 'Ortensia', 'Rosa', 'Limone (vaso)',
  'Litchi', 'Avocado', 'Leonotis (klip dagga)',
]);

export function isAnnual(presetName: string | undefined): boolean {
  const custom = customFor(presetName);
  if (custom) return custom.annual;
  const kind = PLANT_KINDS.find((k) => k.name === presetName);
  if (kind) return !!kind.annual;
  return !!presetName && !PERENNIALS.has(presetName);
}

/** Types a user can pick by hand. Transplant tasks are created by the app. */
export const TASK_TYPES = (Object.keys(TASK_LABEL) as TaskType[]).filter((t) => t !== 'transplant');

// Words people use for a group of catalog plants, in both languages.
const GROUPS: { words: string[]; plants: string[] }[] = [
  {
    words: ['insalata', 'insalate', 'salad', 'lettuce', 'verdura a foglia', 'leafy'],
    plants: ['Lattuga', 'Indivia riccia', 'Scarola', 'Valerianella', 'Rucola', 'Cicoria da taglio', 'Radicchio di Chioggia', 'Radicchio di Treviso tardivo', 'Radicchio di Castelfranco', 'Spinacio'],
  },
  {
    words: ['cavolo', 'cavoli', 'cabbage', 'brassica', 'crucifere'],
    plants: ['Cavolfiore', 'Broccolo', 'Cavolo cappuccio', 'Verza', 'Cavolo nero', 'Cavolo di Bruxelles', 'Cime di rapa'],
  },
  {
    words: ['radicchio', 'cicoria', 'chicory'],
    plants: ['Radicchio di Chioggia', 'Radicchio di Treviso tardivo', 'Radicchio di Castelfranco', 'Cicoria da taglio', 'Indivia riccia', 'Scarola'],
  },
  {
    words: ['aromatiche', 'aromatica', 'erbe', 'odori', 'herbs', 'herb'],
    plants: ['Basilico', 'Prezzemolo', 'Rosmarino', 'Salvia', 'Timo', 'Menta', 'Lavanda'],
  },
  { words: ['fiori', 'fiore', 'flowers', 'flower', 'ornamentali'], plants: ['Ortensia', 'Rosa', 'Lavanda', 'Leonotis (klip dagga)'] },
  { words: ['frutta', 'frutto', 'fruit', 'alberi', 'albero', 'tree'], plants: ['Fragola', 'Limone (vaso)', 'Litchi', 'Avocado'] },
  { words: ['agrumi', 'citrus'], plants: ['Limone (vaso)'] },
  { words: ['tropicali', 'tropicale', 'subtropicale', 'esotiche', 'esotico', 'tropical', 'exotic'], plants: ['Litchi', 'Avocado'] },
  // Other spellings of the same plant.
  { words: ['lichi', 'lici', 'lychee', 'litchi'], plants: ['Litchi'] },
  { words: ['coda di leone', 'lion’s tail', 'lions tail', 'wild dagga', 'dagga'], plants: ['Leonotis (klip dagga)'] },
];

/** The whole catalog: built-in plants, then the ones added from a file. */
export function catalog(): PlantPreset[] {
  return [...PLANT_PRESETS, ...customEntries()];
}

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Catalog plants matching what the user typed: by name in either language
 * (a plural like "pomodori" finds Pomodoro) or by group ("insalata",
 * "cavolo", "aromatiche").
 */
export function searchPresets(query: string): PlantPreset[] {
  const q = normalize(query);
  if (!q) return [];
  // Drop one final letter, so plurals and singulars meet.
  const stem = q.length > 4 ? q.slice(0, -1) : q;
  const fromGroups = new Set(
    GROUPS.filter((g) => g.words.some((w) => normalize(w).startsWith(stem))).flatMap((g) => g.plants),
  );
  const all = catalog();
  const byName = all.filter((p) =>
    [p.name, CATALOG_EN[p.name] ?? customEnglish()[p.name] ?? '', ...(customFor(p.name)?.aliases ?? [])].some((n) =>
      normalize(n).includes(stem),
    ),
  );
  return [...byName, ...all.filter((p) => fromGroups.has(p.name) && !byName.includes(p))];
}

/**
 * The catalog entry for a plant: the one it was created from, else a name
 * match. A plant outside the catalog created from a kind ("Albero da frutto")
 * gets the kind.
 */
export function presetFor(plant: { preset: string | null; name: string }): PlantPreset | undefined {
  const key = (plant.preset ?? plant.name).toLowerCase();
  const match = (p: PlantPreset) => p.name.toLowerCase() === key || cat(p.name).toLowerCase() === key;
  return catalog().find(match) ?? (plant.preset ? PLANT_KINDS.find(match) : undefined);
}
