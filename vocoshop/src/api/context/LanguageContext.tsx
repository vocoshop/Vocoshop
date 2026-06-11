import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fr from "../translations/fr";
import en from "../translations/en";

type Lang = "fr" | "en";

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Lang, Record<string, string>> = { fr, en };

const STORAGE_KEY = "voco:lang";

export const LanguageContext = createContext<LanguageContextType>({
  lang: "fr",
  setLang: async () => {},
  t: (k: string) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fr");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "en" || stored === "fr") {
        setLangState(stored);
      }
    }).catch(() => {});
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let text = translations[lang]?.[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
