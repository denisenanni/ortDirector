// Catalog files: plants with their care, written by hand (or by Claude) and
// added to the catalog from Impostazioni, on top of what's there. Each text
// is Italian, or `{ "it": "…", "en": "…" }` to give the English too. The
// format is described in docs/catalog-file.md. Pure logic, no React Native
// imports, so it runs under `node --test` (see catalogFile.test.ts).
import type { CustomEntry } from './custom.ts';
import { tr } from './i18n.ts';
import { PLANT_KINDS } from './kinds.ts';
import type { PlanStep, SeasonalStep } from './plans.ts';
import { CATALOG_EN } from './catalog-en.ts';
import { PLANT_PRESETS, normalize } from './presets.ts';
import type { Sun, TaskType } from './types';

const SUNS: Sun[] = ['full', 'partial', 'shade'];
const TYPES: TaskType[] = ['water', 'check', 'prune', 'fertilize', 'treat', 'harvest', 'other'];

class Bad extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Reads the plants of a catalog file: each one checked, next to the object
 * it came from, which is what the database keeps. Throws a message in the
 * app's language that it can show as is.
 */
export function parseCatalogFile(text: string): { entry: CustomEntry; raw: unknown }[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(tr('Il file non è JSON valido.', 'The file is not valid JSON.'));
  }
  if (isObj(data) && 'tables' in data) {
    throw new Error(tr('Questo è un backup: usa “Importa backup”.', 'This is a backup: use “Import backup”.'));
  }
  if (!isObj(data) || !Array.isArray(data.catalog) || data.catalog.length === 0) {
    throw new Error(
      tr('Il file non ha piante da aggiungere (manca l’elenco "catalog").', 'The file has no plants to add (the "catalog" list is missing).'),
    );
  }
  const entries = data.catalog.map((raw, i) => ({ entry: parseCatalogEntry(raw, `catalog[${i}]`), raw }));
  const seen = new Set<string>();
  for (const { entry: e } of entries) {
    const key = normalize(e.name);
    if (seen.has(key)) throw new Error(tr(`“${e.name}” compare due volte nel file.`, `“${e.name}” appears twice in the file.`));
    seen.add(key);
  }
  return entries;
}

/** One plant of a catalog file; `where` names it in errors until its name is known. */
export function parseCatalogEntry(raw: unknown, where = ''): CustomEntry {
  const en: Record<string, string> = {};
  let label = where;
  const fail = (path: string, it: string, eng: string): never => {
    throw new Bad(`${label}${path ? ` › ${path}` : ''}: ${tr(it, eng)}`);
  };
  const text = (v: unknown, path: string, required = true): string | undefined => {
    if (v === undefined && !required) return undefined;
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (isObj(v) && typeof v.it === 'string' && v.it.trim()) {
      if (typeof v.en === 'string' && v.en.trim()) en[v.it.trim()] = v.en.trim();
      return v.it.trim();
    }
    return fail(path, 'serve un testo, o { "it": …, "en": … }', 'needs a text, or { "it": …, "en": … }');
  };
  const int = (v: unknown, path: string, min: number, max: number): number => {
    if (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max) return v;
    return fail(path, `serve un numero intero da ${min} a ${max}`, `needs a whole number from ${min} to ${max}`);
  };
  const optInt = (v: unknown, path: string, min: number, max: number) =>
    v === undefined ? undefined : int(v, path, min, max);
  const bool = (v: unknown, path: string): boolean => {
    if (v === undefined) return false;
    if (typeof v === 'boolean') return v;
    return fail(path, 'serve true o false', 'needs true or false');
  };
  const list = (v: unknown, path: string): unknown[] => {
    if (v === undefined) return [];
    if (Array.isArray(v)) return v;
    return fail(path, 'serve un elenco [ … ]', 'needs a list [ … ]');
  };
  const months = (v: unknown, path: string): number[] => {
    const ms = list(v, path).map((m, i) => int(m, `${path}[${i}]`, 1, 12));
    if (ms.length === 0) fail(path, 'servono i mesi, da 1 a 12', 'needs the months, from 1 to 12');
    return ms;
  };
  const type = (v: unknown, path: string): TaskType => {
    if (TYPES.includes(v as TaskType)) return v as TaskType;
    return fail(path, `tipo sconosciuto; usa ${TYPES.join(', ')}`, `unknown type; use ${TYPES.join(', ')}`);
  };

  try {
    if (!isObj(raw)) fail('', 'ogni pianta è un oggetto { … }', 'each plant is an object { … }');
    const r = raw as Obj;
    const name = text(r.name, 'name')!;
    label = name;
    const builtIn = [...PLANT_PRESETS, ...PLANT_KINDS].find((p) =>
      [p.name, CATALOG_EN[p.name] ?? ''].some((n) => normalize(n) === normalize(name)),
    );
    if (builtIn) {
      fail('name', 'c’è già nel catalogo dell’app, usa un altro nome', 'is already in the app’s catalog, use another name');
    }
    if (!SUNS.includes(r.sun as Sun)) fail('sun', 'usa "full", "partial" o "shade"', 'use "full", "partial" or "shade"');
    const waterEveryDays = int(r.waterEveryDays, 'waterEveryDays', 1, 60);
    const waterColdDays = optInt(r.waterColdDays, 'waterColdDays', 1, 90);

    const steps: PlanStep[] = list(r.steps, 'steps').map((s, i) => {
      const p = `steps[${i}]`;
      if (!isObj(s)) return fail(p, 'ogni passo è un oggetto { … }', 'each step is an object { … }');
      const step: PlanStep = { type: type(s.type, `${p}.type`), title: text(s.title, `${p}.title`)!, day: int(s.day, `${p}.day`, 0, 3650) };
      const every = optInt(s.every, `${p}.every`, 1, 365);
      const until = optInt(s.until, `${p}.until`, 0, 3650);
      if (every !== undefined) step.every = every;
      if (until !== undefined) step.until = until;
      if (s.months !== undefined) step.months = months(s.months, `${p}.months`);
      return step;
    });
    const seasonal: SeasonalStep[] = list(r.seasonal, 'seasonal').map((s, i) => {
      const p = `seasonal[${i}]`;
      if (!isObj(s)) return fail(p, 'ogni passo è un oggetto { … }', 'each step is an object { … }');
      const step: SeasonalStep = { type: type(s.type, `${p}.type`), title: text(s.title, `${p}.title`)!, months: months(s.months, `${p}.months`) };
      const every = optInt(s.every, `${p}.every`, 1, 365);
      if (every !== undefined) step.every = every;
      if (s.only !== undefined) {
        if (!isObj(s.only)) fail(`${p}.only`, 'serve un oggetto, es. { "potted": true }', 'needs an object, e.g. { "potted": true }');
        const only: SeasonalStep['only'] = {};
        for (const [k, v] of Object.entries(s.only as Obj)) {
          if (k !== 'potted' && k !== 'tender' && k !== 'young') {
            fail(`${p}.only`, 'solo "potted", "tender" o "young"', 'only "potted", "tender" or "young"');
          }
          only[k as 'potted'] = bool(v, `${p}.only.${k}`);
        }
        step.only = only;
      }
      return step;
    });
    const weeks = list(r.sowToTransplantWeeks, 'sowToTransplantWeeks');
    let sowToTransplantWeeks: [number, number] | undefined;
    if (weeks.length) {
      const [a, b] = weeks.map((w, i) => int(w, `sowToTransplantWeeks[${i}]`, 1, 52));
      if (weeks.length !== 2 || a > b) fail('sowToTransplantWeeks', 'servono due numeri, es. [6, 8]', 'needs two numbers, e.g. [6, 8]');
      sowToTransplantWeeks = [a, b];
    }
    const aliases = list(r.aliases, 'aliases').map((a, i) =>
      typeof a === 'string' && a.trim() ? a.trim() : fail(`aliases[${i}]`, 'serve un testo', 'needs a text'),
    );

    const entry: CustomEntry = {
      name,
      sun: r.sun as Sun,
      waterEveryDays,
      tip: text(r.tip, 'tip', false) ?? '',
      annual: bool(r.annual, 'annual'),
      tender: bool(r.tender, 'tender'),
      aliases,
      plan: { steps, seasonal, ...(sowToTransplantWeeks ? { sowToTransplantWeeks } : {}) },
      en,
    };
    if (waterColdDays !== undefined) entry.waterColdDays = waterColdDays;
    return entry;
  } catch (e) {
    if (e instanceof Bad) throw new Error(e.message);
    throw e;
  }
}
