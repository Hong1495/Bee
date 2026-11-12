import { useSyncExternalStore } from 'react';
import traditional from './locales/zh-Hant.json';
import english from './locales/en.json';
import japanese from './locales/ja.json';

// Autonyms stay unchanged in every interface language so users can switch back.
export const languages = [
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
] as const;
export type Language = typeof languages[number]['value'];
const key = 'bee-language';
export const isLanguage = (value: unknown): value is Language => languages.some(item => item.value === value);
function readLanguage(): Language {
  try { const value = localStorage.getItem(key); return isLanguage(value) ? value : 'zh-Hans'; }
  catch { return 'zh-Hans'; }
}
let language = readLanguage();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => language;
export function useLanguage() { return useSyncExternalStore(subscribe, snapshot); }
export function setLanguage(value: Language) {
  if (!isLanguage(value)) return;
  try { localStorage.setItem(key, value); } catch { /* Keep this session usable if storage is unavailable. */ }
  if (language === value) return;
  language = value;
  document.documentElement.lang = value;
  listeners.forEach(listener => listener());
}
const catalogs: Partial<Record<Language, Record<string, string>>> = { 'zh-Hant': traditional, en: english, ja: japanese };
export function translate(locale: Language, text: string, ...values: unknown[]) {
  const message = catalogs[locale]?.[text] ?? text;
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => Number(index) < values.length ? String(values[Number(index)]) : placeholder);
}
// Also usable in event handlers and native menu factories: resolve at call time.
export const t = (text: string, ...values: unknown[]) => translate(language, text, ...values);
if (typeof document !== 'undefined') document.documentElement.lang = language;
