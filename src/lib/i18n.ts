// Two languages, Italian and English: the phone's, or the one picked in
// Impostazioni (src/lib/locale.ts). Strings stay inline as tr('italiano', 'English')
// so each screen reads in both languages at once. Catalog text (plant names,
// tips, plan steps) is written in Italian and translated through CATALOG_EN,
// or through the English of plants added from a file (custom.ts).
// Pure logic, no React Native imports, so it runs under `node --test`.
import { useSyncExternalStore } from 'react';
import { CATALOG_EN } from './catalog-en.ts';
import { customEnglish, customGeneration } from './custom.ts';

export type Lang = 'it' | 'en';

let current: Lang = 'it';
let dateLocale = 'it-IT';

const listeners = new Set<(lang: Lang) => void>();

/** The tag when dates can be formatted with it; a malformed one (en-US@posix) would throw on every date. */
function validTag(tag: string | undefined): string | undefined {
  try {
    return tag && Intl.DateTimeFormat.supportedLocalesOf([tag]).length ? tag : undefined;
  } catch {
    return undefined;
  }
}

export function setLanguage(lang: Lang, locale?: string) {
  current = lang;
  dateLocale = validTag(locale) ?? (lang === 'it' ? 'it-IT' : 'en-GB');
  listeners.forEach((l) => l(lang));
}

/** Calls `listener` on every language change; returns the unsubscribe. */
export function onLanguageChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function language(): Lang {
  return current;
}

/** The current language, redrawing the component when it changes. */
export function useLanguage(): Lang {
  return useSyncExternalStore(onLanguageChange, language);
}

/** Locale tag for toLocaleDateString. */
export function locale(): string {
  return dateLocale;
}

/** The Italian or English text, by the app's language. */
export function tr(it: string, en: string): string {
  return current === 'en' ? en : it;
}

/** Catalog text, written in Italian, in the app's language. Unknown text comes back as is. */
export function cat(text: string): string {
  return current === 'en' ? (CATALOG_EN[text] ?? customEnglish()[text] ?? text) : text;
}

// Titles the app itself saves with tasks and history, beyond the catalog.
const SAVED_EN: Record<string, string> = {
  Annaffiare: 'Water',
  Controllo: 'Check',
  Potatura: 'Prune',
  Concimazione: 'Feed',
  Trattamento: 'Treat',
  Raccolta: 'Harvest',
  Trapianto: 'Transplant',
  Altro: 'Other',
  'Pronta da trapiantare': 'Ready to transplant',
  'Messa a dimora': 'Planted out',
  'Messa nel vaso definitivo': 'Potted up',
  'Messa in vaso': 'Moved into a pot',
  'Messa in terra': 'Moved into the ground',
  'Rinvaso': 'Repotted',
  Spostata: 'Moved',
};
let toItalian: Record<string, string> | null = null;
let toItalianGeneration = -1;

/**
 * Text saved in the database in either language (plant names from the
 * catalog, task and history titles), shown in the app's language. Text the
 * user typed matches nothing and comes back as is.
 */
export function local(text: string): string {
  if (current === 'en') return SAVED_EN[text] ?? CATALOG_EN[text] ?? customEnglish()[text] ?? text;
  if (!toItalian || toItalianGeneration !== customGeneration()) {
    toItalian = {};
    toItalianGeneration = customGeneration();
    for (const map of [CATALOG_EN, SAVED_EN, customEnglish()]) {
      for (const [it, en] of Object.entries(map)) toItalian[en] ??= it;
    }
  }
  return toItalian[text] ?? text;
}

/** "1 giorno" / "3 giorni", "1 day" / "3 days". */
export function days(n: number): string {
  return current === 'en' ? (n === 1 ? '1 day' : `${n} days`) : n === 1 ? '1 giorno' : `${n} giorni`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
