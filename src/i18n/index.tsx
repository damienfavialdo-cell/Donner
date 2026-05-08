import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import translations, { type Lang, langNames } from './translations';

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  langNames: Record<Lang, string>;
  langs: Lang[];
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'ong-made-lang';

function getInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in translations) return stored as Lang;
  } catch {}
  return 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem(STORAGE_KEY, newLang); } catch {}
  }, []);

  const t = useCallback((key: string): string => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, langNames, langs: ['mg', 'fr', 'en', 'it'] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}


