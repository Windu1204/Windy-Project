import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import dictionary from './translations.json';
export type Language = 'id' | 'en';
const labels: Record<string, string[]> = dictionary;
export function translate(label: string, language: Language) { return labels[label]?.[language === 'id' ? 0 : 1] ?? label; }
const LanguageContext = createContext({ language: 'id' as Language, setLanguage: (_language: Language) => {}, t: (label: string) => translate(label, 'id') });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, update] = useState<Language>(() => { try { return localStorage.getItem('wci-language') === 'en' ? 'en' : 'id'; } catch { return 'id'; } });
  useEffect(() => { document.documentElement.lang = language; try { localStorage.setItem('wci-language', language); } catch { /* Language remains usable when storage is disabled. */ } }, [language]);
  const value = useMemo(() => ({ language, setLanguage: update, t: (label: string) => translate(label, language) }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage() { return useContext(LanguageContext); }
