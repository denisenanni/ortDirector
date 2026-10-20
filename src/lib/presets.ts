import type { Sun, TaskType } from './types';

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
];

export const SUN_LABEL: Record<Sun, string> = {
  full: 'Pieno sole',
  partial: 'Mezz’ombra',
  shade: 'Ombra',
};

export const SUN_ICON: Record<Sun, string> = {
  full: '☀️',
  partial: '⛅',
  shade: '☁️',
};

export const TASK_LABEL: Record<TaskType, string> = {
  water: 'Annaffiare',
  check: 'Controllo',
  prune: 'Potatura',
  fertilize: 'Concimazione',
  treat: 'Trattamento',
  harvest: 'Raccolta',
  transplant: 'Trapianto',
  other: 'Altro',
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

export const MONTH_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "apr–set", "feb", "mar, nov–gen": months as runs of consecutive months. */
export function monthsLabel(months: number[]): string {
  const set = new Set(months);
  if (set.size === 12) return 'tutto l’anno';
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
    .map(([a, b]) => (a === b ? MONTH_SHORT[a - 1] : `${MONTH_SHORT[a - 1]}–${MONTH_SHORT[b - 1]}`))
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
  if (t.yearly) return season ? `ogni anno, ${season}` : 'ogni anno';
  if (!t.repeatDays) return '';
  const days = (n: number) => (n === 1 ? 'giorno' : `${n} giorni`);
  let every = `ogni ${days(t.repeatDays)}`;
  if (t.coldRepeatDays && t.coldRepeatDays !== t.repeatDays) every += ` (ott–apr ogni ${days(t.coldRepeatDays)})`;
  return season ? `${every}, ${season}` : every;
}

/** Catalog plants that live for years; every other catalog plant is an annual crop. */
const PERENNIALS = new Set([
  'Fragola', 'Menta', 'Rosmarino', 'Salvia', 'Lavanda', 'Timo', 'Ortensia', 'Rosa', 'Limone (vaso)',
]);

export function isAnnual(presetName: string | undefined): boolean {
  return !!presetName && !PERENNIALS.has(presetName);
}

/** Types a user can pick by hand. Transplant tasks are created by the app. */
export const TASK_TYPES = (Object.keys(TASK_LABEL) as TaskType[]).filter((t) => t !== 'transplant');

/** The catalog entry for a plant: the one it was created from, else a name match. */
export function presetFor(plant: { preset: string | null; name: string }): PlantPreset | undefined {
  const key = (plant.preset ?? plant.name).toLowerCase();
  return PLANT_PRESETS.find((p) => p.name.toLowerCase() === key);
}
