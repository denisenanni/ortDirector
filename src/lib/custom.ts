// Plants added to the catalog from a file (catalogFile.ts reads the file).
// They live in the database and are loaded here at start-up, so the catalog
// lookups in presets.ts, plans.ts and i18n.ts see them next to the built-in
// ones. Only type imports, so every catalog module can read it.
import type { CropPlan } from './plans';
import type { PlantPreset } from './presets';

export interface CustomEntry extends PlantPreset {
  /** Watering interval the rest of the year, when the default guess is wrong. */
  waterColdDays?: number;
  annual: boolean;
  /** Can't stand frost: seasonal steps with `only: { tender: true }` apply. */
  tender: boolean;
  /** Other names the catalog search finds it by. */
  aliases: string[];
  plan: CropPlan;
  /** English for the entry's texts, keyed by the Italian. */
  en: Record<string, string>;
}

let entries: CustomEntry[] = [];
let english: Record<string, string> = {};
let generation = 0;

export function setCustomCatalog(list: CustomEntry[]) {
  entries = list;
  english = Object.assign({}, ...list.map((e) => e.en));
  generation++;
}

export function customEntries(): CustomEntry[] {
  return entries;
}

export function customFor(name: string | null | undefined): CustomEntry | undefined {
  return name ? entries.find((e) => e.name === name) : undefined;
}

export function customEnglish(): Record<string, string> {
  return english;
}

/** Changes on every reload, so caches built from the catalog know to rebuild. */
export function customGeneration(): number {
  return generation;
}
