import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import esTranslation from './locales/es.json';

const stored = localStorage.getItem('i18nextLng') || '';
const savedLanguage = stored.toLowerCase().startsWith('es') ? 'es' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      es: { translation: esTranslation }
    },
    lng: savedLanguage,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

i18n.on('languageChanged', (lng) => {
  const norm = (lng || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  localStorage.setItem('i18nextLng', norm);
});

export default i18n;

