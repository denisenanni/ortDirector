// Two languages, Italian and English: the phone's, or the one picked in
// Impostazioni (src/lib/locale.ts). Strings stay inline as tr('italiano', 'English')
// so each screen reads in both languages at once. Catalog text (plant names,
// tips, plan steps) is written in Italian and translated through CATALOG_EN.
// Pure logic, no React Native imports, so it runs under `node --test`.
import { useSyncExternalStore } from 'react';
import { CATALOG_EN } from './catalog-en.ts';

export type Lang = 'it' | 'en';

let current: Lang = 'it';
let dateLocale = 'it-IT';

const listeners = new Set<(lang: Lang) => void>();

export function setLanguage(lang: Lang, locale?: string) {
  current = lang;
  dateLocale = locale ?? (lang === 'it' ? 'it-IT' : 'en-GB');
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
  return current === 'en' ? (CATALOG_EN[text] ?? text) : text;
}

/** "1 giorno" / "3 giorni", "1 day" / "3 days". */
export function days(n: number): string {
  return current === 'en' ? (n === 1 ? '1 day' : `${n} days`) : n === 1 ? '1 giorno' : `${n} giorni`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
