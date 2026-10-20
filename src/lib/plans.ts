// Care plans from the catalog: what to do after a plant goes into its final
// spot, counted from that day. Pure logic, no React Native imports, so it runs
// under `node --test` (see plans.test.ts).
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
    const base = { type: s.type, title: s.title, yearly: false, months };
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

/** The calendar care of a plant added on `today`: each step at its next season. */
export function seasonalTasks(plan: CropPlan | undefined, today: DayString): PlannedTask[] {
  return (plan?.seasonal ?? []).map((s) => ({
    type: s.type,
    title: s.title,
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
    notes: `Di solito ${weeks[0]}-${weeks[1]} settimane dalla semina.`,
  };
}
