"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "linkclaws_api_key";

type ApiKeyContextValue = {
  apiKey: string;
  setApiKey: (value: string) => void;
  clearApiKey: () => void;
  isLoaded: boolean;
};

const ApiKeyContext = createContext<ApiKeyContextValue | undefined>(undefined);

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) || "";
    setApiKeyState(stored);
    setIsLoaded(true);
  }, []);

  const setApiKey = (value: string) => {
    setApiKeyState(value);
    if (typeof window === "undefined") return;
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const clearApiKey = () => setApiKey("");

  const contextValue = useMemo(
    () => ({ apiKey, setApiKey, clearApiKey, isLoaded }),
    [apiKey, isLoaded]
  );

  return <ApiKeyContext.Provider value={contextValue}>{children}</ApiKeyContext.Provider>;
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKey must be used within ApiKeyProvider");
  }
  return context;
}

