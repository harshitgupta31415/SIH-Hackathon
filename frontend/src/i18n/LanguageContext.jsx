import { createContext, useContext, useState, useCallback } from 'react';
import en from './locales/en.json';
import hi from './locales/hi.json';
import bn from './locales/bn.json';
import as from './locales/as.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';

const LANGUAGES = {
  en: { native: 'English', label: 'English', dir: 'ltr' },
  hi: { native: 'हिन्दी', label: 'Hindi', dir: 'ltr' },
  bn: { native: 'বাংলা', label: 'Bengali', dir: 'ltr' },
  as: { native: 'অসমীয়া', label: 'Assamese', dir: 'ltr' },
  mr: { native: 'मराठी', label: 'Marathi', dir: 'ltr' },
  ta: { native: 'தமிழ்', label: 'Tamil', dir: 'ltr' },
};

const translations = { en, hi, bn, as, mr, ta };
const STORAGE_KEY = 'healthwatch_lang';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((code) => {
    if (translations[code]) {
      setLangState(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {}
    }
  }, []);

  const t = useCallback(
    (key) => {
      return translations[lang]?.[key] || translations.en[key] || key;
    },
    [lang]
  );

  const langInfo = LANGUAGES[lang] || LANGUAGES.en;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, langInfo, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
