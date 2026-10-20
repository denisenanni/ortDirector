// Picks the app's language from the phone's settings, once, before any screen
// renders: Italian on an Italian phone, English everywhere else.
import { getLocales } from 'expo-localization';
import { setLanguage } from './i18n';

const first = getLocales()[0];
if (first?.languageCode === 'it') setLanguage('it', first.languageTag);
else setLanguage('en', first?.languageCode === 'en' ? first.languageTag : 'en-GB');
