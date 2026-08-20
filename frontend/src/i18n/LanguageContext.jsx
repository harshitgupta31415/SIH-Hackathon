import { createContext, useCallback, useContext, useEffect, useState } from 'react';
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
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // oxlint-disable-next-line react/set-state-in-effect -- hydrate the browser preference after server rendering.
      if (saved && translations[saved]) setLangState(saved);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  const setLang = useCallback((code) => {
    if (translations[code]) {
      setLangState(code);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
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

// oxlint-disable-next-line react/only-export-components -- provider and its hook form one public module
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider');
  return ctx;
}
