// Picks the app's language before any screen renders: the choice made in
// Impostazioni if there is one, else the phone's language (Italian on an
// Italian phone, English everywhere else). The choice lives in expo-sqlite's
// key-value store, which can be read synchronously at start-up; on web that
// store fights the main database for the same file, so localStorage is used.
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';
import KvStore from 'expo-sqlite/kv-store';
import { setLanguage, type Lang } from './i18n';

export type LanguageChoice = 'system' | Lang;

const KEY = 'language';

const Storage =
  Platform.OS === 'web'
    ? {
        getItemSync: (k: string) => localStorage.getItem(k),
        setItemSync: (k: string, v: string) => localStorage.setItem(k, v),
        removeItemSync: (k: string) => localStorage.removeItem(k),
      }
    : KvStore;

export function languageChoice(): LanguageChoice {
  try {
    const v = Storage.getItemSync(KEY);
    return v === 'it' || v === 'en' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: LanguageChoice) {
  const first = getLocales()[0];
  const phone: Lang = first?.languageCode === 'it' ? 'it' : 'en';
  const lang = choice === 'system' ? phone : choice;
  // Dates follow the phone's region when it speaks the chosen language.
  const tag = first?.languageCode === lang ? first.languageTag : undefined;
  setLanguage(lang, tag);
}

export function chooseLanguage(choice: LanguageChoice) {
  if (choice === 'system') Storage.removeItemSync(KEY);
  else Storage.setItemSync(KEY, choice);
  apply(choice);
}

apply(languageChoice());
