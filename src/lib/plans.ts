// Care plans from the catalog: what to do after a plant goes into its final
// spot, counted from that day. Pure logic, no React Native imports, so it runs
// under `node --test` (see plans.test.ts).
import { cat, tr } from './i18n.ts';
import { addDays, nextInSeason } from './schedule.ts';
import type { DayString, TaskType } from './types';

export interface PlanStep {
  type: TaskType;
  title: string;
  /** Days after the transplant. */
  day: number;
  /** Repeat every N days, starting on `day`. */
  every?: number;
  /** Last day (after the transplant) a repeating step may fall on. */
  until?: number;
  /** Months (1-12) the step may fall in. */
  months?: number[];
}

/** Care that follows the calendar, not the planting day: prune in February. */
export interface SeasonalStep {
  type: TaskType;
  title: string;
  months: number[];
  /** Every N days within the months; without it, once a year. */
  every?: number;
  /** Only for plants that match: `{ potted: true }` is for pots only, `{ tender: true }` for plants that fear frost. */
  only?: Partial<CareContext>;
}

/** What the user told about the plant when adding it, beyond the catalog. */
export interface CareContext {
  potted: boolean;
  /** Can't stand frost. */
  tender: boolean;
  /** Young or small: pruned to shape it, not to keep it. */
  young: boolean;
}

export interface CropPlan {
  /** Typical weeks from sowing to transplant, for plants started in a seedbed. */
  sowToTransplantWeeks?: [number, number];
  steps: PlanStep[];
  seasonal?: SeasonalStep[];
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Summer crops fruit from June and stop with the first cold. */
const SUMMER = range(5, 10);
const HARVEST = range(6, 10);

/** Autumn and winter crops are picked from October through March. */
const COLD = [10, 11, 12, 1, 2, 3];
/** Cabbage white caterpillars are about from June to October. */
const cavolaia = (until: number): PlanStep => ({
  type: 'check',
  title: 'Controllo cavolaia (sotto le foglie)',
  day: 14,
  every: 7,
  until,
  months: range(6, 10),
});

/** Winter protection for plants that fear frost: pots go under cover, plants in the ground get covered. */
const frost = (only: Partial<CareContext> = {}): SeasonalStep[] => [
  { type: 'other', title: 'Mettere al riparo dal gelo', months: [11], only: { ...only, potted: true } },
  { type: 'other', title: 'Riportare fuori', months: [4], only: { ...only, potted: true } },
  { type: 'other', title: 'Pacciamare e coprire con tessuto non tessuto', months: [11], only: { ...only, potted: false } },
  { type: 'other', title: 'Togliere la protezione invernale', months: [3], only: { ...only, potted: false } },
];

const repot: SeasonalStep = { type: 'other', title: 'Controllare se serve un vaso più grande', months: [3], only: { potted: true } };

const establish = (every: number, until: number): PlanStep => ({
  type: 'water',
  title: 'Annaffiare (attecchimento)',
  day: 0,
  every,
  until,
});

// Rough guidelines for a temperate Italian garden, keyed by catalog name.
// Steps of summer crops are limited to their season, so a late transplant
// doesn't schedule a tomato harvest in January. Perennials have `seasonal`
// care instead, which follows the calendar and starts when the plant is added.
export const PLANS: Record<string, CropPlan> = {
  Pomodoro: {
    sowToTransplantWeeks: [6, 8],
    steps: [
      establish(1, 13),
      { type: 'other', title: 'Mettere il tutore', day: 7 },
      { type: 'prune', title: 'Togliere le femminelle', day: 14, every: 7, until: 120, months: SUMMER },
      { type: 'fertilize', title: 'Concimazione', day: 15, every: 21, until: 120, months: SUMMER },
      { type: 'check', title: 'Controllo foglie (peronospora)', day: 30, every: 14, until: 120, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 70, every: 3, until: 150, months: HARVEST },
    ],
  },
  Zucchina: {
    sowToTransplantWeeks: [3, 4],
    steps: [
      establish(1, 10),
      { type: 'fertilize', title: 'Concimazione', day: 20, every: 21, until: 100, months: SUMMER },
      { type: 'check', title: 'Controllo foglie (oidio)', day: 30, every: 14, until: 110, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 45, every: 2, until: 120, months: HARVEST },
    ],
  },
  Melanzana: {
    sowToTransplantWeeks: [8, 10],
    steps: [
      establish(1, 13),
      { type: 'other', title: 'Mettere il tutore', day: 10 },
      { type: 'fertilize', title: 'Concimazione', day: 20, every: 21, until: 120, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 75, every: 5, until: 150, months: HARVEST },
    ],
  },
  Peperone: {
    sowToTransplantWeeks: [8, 10],
    steps: [
      establish(1, 13),
      { type: 'other', title: 'Mettere il tutore', day: 14 },
      { type: 'fertilize', title: 'Concimazione', day: 20, every: 21, until: 120, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 80, every: 5, until: 160, months: HARVEST },
    ],
  },
  Peperoncino: {
    sowToTransplantWeeks: [8, 10],
    steps: [
      establish(1, 13),
      { type: 'fertilize', title: 'Concimazione', day: 20, every: 30, until: 120, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 90, every: 7, until: 170, months: HARVEST },
    ],
  },
  Cetriolo: {
    sowToTransplantWeeks: [3, 4],
    steps: [
      establish(1, 10),
      { type: 'other', title: 'Guidare i tralci sulla rete', day: 10, every: 7, until: 50 },
      { type: 'fertilize', title: 'Concimazione', day: 20, every: 21, until: 90, months: SUMMER },
      { type: 'harvest', title: 'Raccolta', day: 50, every: 2, until: 110, months: HARVEST },
    ],
  },
  Fagiolino: {
    sowToTransplantWeeks: [2, 3],
    steps: [
      establish(1, 7),
      { type: 'other', title: 'Rincalzare', day: 20 },
      { type: 'harvest', title: 'Raccolta', day: 55, every: 3, until: 90, months: HARVEST },
    ],
  },
  Lattuga: {
    sowToTransplantWeeks: [4, 6],
    steps: [establish(1, 7), { type: 'harvest', title: 'Raccolta', day: 45, every: 4, until: 75 }],
  },
  Rucola: {
    sowToTransplantWeeks: [2, 3],
    steps: [establish(1, 5), { type: 'harvest', title: 'Raccolta', day: 25, every: 5, until: 60 }],
  },
  Spinacio: {
    sowToTransplantWeeks: [4, 5],
    steps: [establish(1, 7), { type: 'harvest', title: 'Raccolta', day: 40, every: 5, until: 70 }],
  },
  // Carrots don't transplant: "a dimora" is the sowing day.
  Carota: {
    steps: [
      { type: 'other', title: 'Diradare le piantine', day: 20 },
      { type: 'harvest', title: 'Raccolta', day: 75, every: 7, until: 110 },
    ],
  },
  Finocchio: {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      { type: 'other', title: 'Rincalzare il grumolo', day: 40 },
      { type: 'other', title: 'Rincalzare il grumolo', day: 60 },
      { type: 'harvest', title: 'Raccolta', day: 80, every: 7, until: 120 },
    ],
  },
  'Indivia riccia': {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      { type: 'other', title: 'Legare per imbianchire', day: 75 },
      { type: 'harvest', title: 'Raccolta', day: 90, every: 7, until: 130 },
    ],
  },
  Scarola: {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      { type: 'other', title: 'Legare per imbianchire', day: 75 },
      { type: 'harvest', title: 'Raccolta', day: 90, every: 7, until: 130 },
    ],
  },
  // Sown where it grows, like carrots.
  Valerianella: {
    steps: [
      { type: 'other', title: 'Diradare le piantine', day: 20 },
      { type: 'harvest', title: 'Raccolta', day: 60, every: 7, until: 150 },
    ],
  },
  'Cicoria da taglio': {
    steps: [{ type: 'harvest', title: 'Taglio', day: 40, every: 20, until: 160 }],
  },
  'Radicchio di Chioggia': {
    sowToTransplantWeeks: [5, 6],
    steps: [establish(1, 10), { type: 'harvest', title: 'Raccolta', day: 90, every: 7, until: 150 }],
  },
  'Radicchio di Treviso tardivo': {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      { type: 'other', title: 'Espiantare e forzare al buio', day: 120, months: [11, 12, 1] },
      { type: 'harvest', title: 'Raccolta dopo la forzatura', day: 140, every: 7, until: 200, months: [12, 1, 2, 3] },
    ],
  },
  'Radicchio di Castelfranco': {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      { type: 'harvest', title: 'Raccolta (dopo le gelate)', day: 110, every: 7, until: 170, months: [11, 12, 1, 2] },
    ],
  },
  Cavolfiore: {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      cavolaia(90),
      { type: 'fertilize', title: 'Concimazione', day: 30, every: 30, until: 70 },
      { type: 'other', title: 'Coprire la testa con le foglie', day: 80 },
      { type: 'harvest', title: 'Raccolta', day: 90, every: 4, until: 130 },
    ],
  },
  Broccolo: {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      cavolaia(90),
      { type: 'fertilize', title: 'Concimazione', day: 30, every: 30, until: 70 },
      { type: 'harvest', title: 'Raccolta (testa e getti laterali)', day: 75, every: 4, until: 130 },
    ],
  },
  'Cavolo cappuccio': {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      cavolaia(100),
      { type: 'other', title: 'Rincalzare', day: 30 },
      { type: 'harvest', title: 'Raccolta', day: 100, every: 7, until: 150 },
    ],
  },
  Verza: {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      cavolaia(110),
      { type: 'other', title: 'Rincalzare', day: 30 },
      { type: 'harvest', title: 'Raccolta', day: 120, every: 7, until: 180, months: COLD },
    ],
  },
  'Cavolo nero': {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      cavolaia(110),
      { type: 'harvest', title: 'Raccolta foglie', day: 80, every: 7, until: 220, months: COLD },
    ],
  },
  'Cavolo di Bruxelles': {
    sowToTransplantWeeks: [5, 6],
    steps: [
      establish(1, 10),
      cavolaia(110),
      { type: 'other', title: 'Rincalzare', day: 30 },
      { type: 'prune', title: 'Cimare la pianta', day: 120 },
      { type: 'harvest', title: 'Raccolta', day: 140, every: 7, until: 220, months: [11, 12, 1, 2, 3] },
    ],
  },
  // Sown where it grows.
  'Cime di rapa': {
    steps: [
      { type: 'other', title: 'Diradare le piantine', day: 15 },
      { type: 'harvest', title: 'Raccolta', day: 60, every: 5, until: 100 },
    ],
  },
  Cipolla: {
    sowToTransplantWeeks: [8, 10],
    steps: [
      establish(2, 14),
      { type: 'other', title: 'Sarchiare', day: 30, every: 21, until: 100 },
      { type: 'harvest', title: 'Raccolta (quando le foglie seccano)', day: 110 },
    ],
  },
  Aglio: {
    steps: [
      { type: 'other', title: 'Sarchiare', day: 60, every: 30, until: 180 },
      { type: 'harvest', title: 'Raccolta (quando le foglie seccano)', day: 210 },
    ],
  },
  Fragola: {
    steps: [
      establish(1, 14),
      { type: 'prune', title: 'Togliere gli stoloni', day: 30, every: 14, until: 120 },
      { type: 'fertilize', title: 'Concimazione', day: 30, every: 30, until: 150 },
    ],
  },
  Basilico: {
    sowToTransplantWeeks: [4, 6],
    steps: [
      establish(1, 10),
      { type: 'prune', title: 'Cimare i fiori', day: 21, every: 7, until: 120, months: SUMMER },
      { type: 'harvest', title: 'Raccolta foglie', day: 30, every: 5, until: 140, months: HARVEST },
    ],
  },
  Prezzemolo: {
    sowToTransplantWeeks: [6, 8],
    steps: [establish(1, 14), { type: 'harvest', title: 'Raccolta', day: 60, every: 7, until: 200 }],
  },
  Menta: {
    steps: [establish(1, 10), { type: 'prune', title: 'Accorciare i getti', day: 45, every: 30, until: 180 }],
  },
  Rosmarino: {
    steps: [establish(3, 30)],
    seasonal: [{ type: 'prune', title: 'Potatura dopo la fioritura', months: [5, 6] }],
  },
  Salvia: {
    steps: [establish(3, 30)],
    seasonal: [{ type: 'prune', title: 'Potatura dopo la fioritura', months: [6, 7] }],
  },
  Lavanda: {
    steps: [establish(3, 30)],
    seasonal: [{ type: 'prune', title: 'Potatura (mai sul legno vecchio)', months: [8, 9] }],
  },
  Timo: {
    steps: [establish(3, 30)],
    seasonal: [{ type: 'prune', title: 'Potatura dopo la fioritura', months: [6, 7] }],
  },
  Ortensia: {
    steps: [establish(2, 30)],
    seasonal: [
      { type: 'prune', title: 'Potatura e fiori secchi', months: [3] },
      { type: 'fertilize', title: 'Concimazione (acidofile)', months: range(4, 8), every: 30 },
    ],
  },
  Rosa: {
    steps: [establish(2, 30)],
    seasonal: [
      { type: 'prune', title: 'Potatura', months: [2] },
      { type: 'fertilize', title: 'Concimazione', months: range(3, 9), every: 30 },
      { type: 'check', title: 'Controllo afidi e oidio', months: range(4, 9), every: 14 },
    ],
  },
  'Limone (vaso)': {
    steps: [establish(2, 21)],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione (agrumi)', months: range(3, 9), every: 30 },
      { type: 'other', title: 'Mettere al riparo dal gelo', months: [11] },
      { type: 'other', title: 'Riportare fuori', months: [4] },
    ],
  },
  // Fruits on the tips of the new shoots: prune lightly, right after picking.
  Litchi: {
    steps: [establish(2, 60)],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione leggera (acidofile)', months: range(3, 8), every: 30 },
      { type: 'harvest', title: 'Raccolta', months: [7] },
      { type: 'prune', title: 'Potatura leggera dopo la raccolta', months: [8] },
      { type: 'check', title: 'Controllo cocciniglie e acari', months: range(5, 9), every: 30 },
      repot,
      ...frost(),
    ],
  },
  Avocado: {
    steps: [establish(3, 60)],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione', months: range(3, 8), every: 45 },
      { type: 'other', title: 'Rinnovare la pacciamatura', months: [4] },
      { type: 'prune', title: 'Potatura leggera', months: [4] },
      repot,
      ...frost(),
    ],
  },
  // Half hardy: in the ground it can die back to the roots and regrow.
  'Leonotis (klip dagga)': {
    steps: [establish(3, 30)],
    seasonal: [
      { type: 'prune', title: 'Potatura drastica (a 30 cm da terra)', months: [3] },
      { type: 'fertilize', title: 'Concimazione', months: range(4, 6), every: 30 },
      { type: 'prune', title: 'Togliere i fiori secchi', months: range(9, 11), every: 21 },
      repot,
      { type: 'other', title: 'Mettere al riparo dal gelo', months: [11], only: { potted: true } },
      { type: 'other', title: 'Riportare fuori', months: [4], only: { potted: true } },
      { type: 'other', title: 'Pacciamare la base contro il gelo', months: [11], only: { potted: false } },
    ],
  },

  // Kinds, for plants outside the catalog (kinds.ts). Frost protection only
  // when the user says the plant fears frost.
  'Albero da frutto': {
    steps: [establish(3, 60)],
    seasonal: [
      { type: 'prune', title: 'Potatura di formazione', months: [2], only: { young: true } },
      { type: 'prune', title: 'Potatura invernale', months: [2], only: { young: false } },
      { type: 'treat', title: 'Trattamento invernale (rame)', months: [2] },
      { type: 'fertilize', title: 'Concimazione', months: [3] },
      { type: 'check', title: 'Controllo afidi e malattie', months: range(4, 7), every: 21 },
      repot,
      ...frost({ tender: true }),
    ],
  },
  'Albero da frutto tropicale': {
    steps: [establish(2, 60)],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione', months: range(3, 9), every: 30 },
      { type: 'prune', title: 'Potatura di formazione', months: [4], only: { young: true } },
      { type: 'prune', title: 'Potatura leggera', months: [4], only: { young: false } },
      { type: 'check', title: 'Controllo cocciniglie e acari', months: range(5, 9), every: 30 },
      repot,
      ...frost({ tender: true }),
    ],
  },
  Agrume: {
    steps: [establish(2, 45)],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione (agrumi)', months: range(3, 9), every: 30 },
      { type: 'prune', title: 'Potatura leggera', months: [3] },
      { type: 'check', title: 'Controllo cocciniglie e acari', months: range(5, 9), every: 30 },
      repot,
      ...frost({ tender: true }),
    ],
  },
  'Albero ornamentale': {
    steps: [establish(3, 90)],
    seasonal: [
      { type: 'prune', title: 'Potatura di formazione', months: [2], only: { young: true } },
      { type: 'prune', title: 'Togliere rami secchi e incrociati', months: [2], only: { young: false } },
      repot,
      ...frost({ tender: true }),
    ],
  },
  Arbusto: {
    steps: [establish(2, 45)],
    seasonal: [
      { type: 'prune', title: 'Potatura', months: [3] },
      { type: 'fertilize', title: 'Concimazione', months: [3] },
      repot,
      ...frost({ tender: true }),
    ],
  },
  Siepe: {
    steps: [establish(2, 60)],
    seasonal: [
      { type: 'prune', title: 'Tosatura', months: [6] },
      { type: 'prune', title: 'Tosatura', months: [9] },
      { type: 'fertilize', title: 'Concimazione', months: [3] },
      ...frost({ tender: true }),
    ],
  },
  Rampicante: {
    steps: [establish(2, 45)],
    seasonal: [
      { type: 'prune', title: 'Potatura', months: [2] },
      { type: 'other', title: 'Legare i tralci nuovi', months: range(4, 8), every: 30 },
      { type: 'fertilize', title: 'Concimazione', months: range(3, 6), every: 30 },
      repot,
      ...frost({ tender: true }),
    ],
  },
  'Perenne da fiore': {
    steps: [establish(1, 21)],
    seasonal: [
      { type: 'prune', title: 'Tagliare gli steli secchi', months: [2] },
      { type: 'fertilize', title: 'Concimazione', months: range(3, 6), every: 30 },
      { type: 'prune', title: 'Togliere i fiori secchi', months: range(5, 9), every: 14 },
      repot,
      ...frost({ tender: true }),
    ],
  },
  'Annuale da fiore': {
    steps: [establish(1, 14)],
    seasonal: [
      { type: 'prune', title: 'Togliere i fiori secchi', months: range(5, 9), every: 7 },
      { type: 'fertilize', title: 'Concimazione (piante fiorite)', months: range(5, 9), every: 14 },
    ],
  },
  'Succulenta o cactus': {
    steps: [],
    seasonal: [
      { type: 'fertilize', title: 'Concimazione (piante grasse)', months: range(4, 9), every: 30 },
      { ...repot, months: [4] },
      ...frost({ tender: true }),
    ],
  },
};

export function planFor(presetName: string | undefined): CropPlan | undefined {
  return presetName ? PLANS[presetName] : undefined;
}

export interface PlannedTask {
  type: TaskType;
  title: string;
  dueOn: DayString;
  repeatDays: number | null;
  endsOn: DayString | null;
  yearly: boolean;
  months: number[] | null;
}

/**
 * The tasks a plan creates for a plant transplanted on `transplantedOn`.
 * When the transplant is back-dated, one-off steps already in the past are
 * dropped and repeating ones start at their next date from `today`, so
 * marking an old transplant doesn't flood "Oggi" with overdue tasks.
 * Steps with months move to their season, and are dropped when their season
 * only comes back after the step's last day.
 */
export function expandPlan(steps: PlanStep[], transplantedOn: DayString, today: DayString): PlannedTask[] {
  const out: PlannedTask[] = [];
  for (const s of steps) {
    const months = s.months ?? null;
    let due = nextInSeason(addDays(transplantedOn, s.day), months);
    const base = { type: s.type, title: cat(s.title), yearly: false, months };
    if (!s.every) {
      if (due >= today) out.push({ ...base, dueOn: due, repeatDays: null, endsOn: null });
      continue;
    }
    const endsOn = s.until === undefined ? null : addDays(transplantedOn, s.until);
    while (due < today) due = nextInSeason(addDays(due, s.every), months);
    if (endsOn && due > endsOn) continue;
    out.push({ ...base, dueOn: due, repeatDays: s.every, endsOn });
  }
  return out;
}

/** Whether a seasonal step applies to the plant; what the user didn't say counts as no. */
function applies(s: SeasonalStep, care: Partial<CareContext>): boolean {
  return Object.entries(s.only ?? {}).every(([k, v]) => (care[k as keyof CareContext] ?? false) === v);
}

/** The calendar care of a plant added on `today`: each step at its next season. */
export function seasonalTasks(
  plan: CropPlan | undefined,
  today: DayString,
  care: Partial<CareContext> = {},
): PlannedTask[] {
  return (plan?.seasonal ?? []).filter((s) => applies(s, care)).map((s) => ({
    type: s.type,
    title: cat(s.title),
    dueOn: nextInSeason(today, s.months),
    repeatDays: s.every ?? null,
    endsOn: null,
    yearly: !s.every,
    months: s.months,
  }));
}

/**
 * The day after the plan's establishment watering ends, when the plant's
 * regular watering should take over. Null when the plan has none.
 */
export function regularWateringFrom(steps: PlanStep[], transplantedOn: DayString): DayString | null {
  const until = steps
    .filter((s) => s.type === 'water' && s.until !== undefined)
    .reduce<number | null>((max, s) => Math.max(max ?? 0, s.until!), null);
  return until === null ? null : addDays(transplantedOn, until + 1);
}

/** The "ready to transplant" reminder for a plant sown on `sownOn`. */
export function transplantReminder(
  plan: CropPlan | undefined,
  sownOn: DayString,
): { dueOn: DayString; notes: string } | null {
  const weeks = plan?.sowToTransplantWeeks;
  if (!weeks) return null;
  return {
    dueOn: addDays(sownOn, weeks[0] * 7),
    notes: tr(
      `Di solito ${weeks[0]}-${weeks[1]} settimane dalla semina.`,
      `Usually ${weeks[0]}-${weeks[1]} weeks after sowing.`,
    ),
  };
}
