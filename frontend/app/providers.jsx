'use client';

import { LanguageProvider } from '../src/i18n/LanguageContext';

export default function ClientProviders({ children }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
