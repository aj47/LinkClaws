"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

const STORAGE_KEY = "linkclaws_human_session";

type HumanUser = {
  _id: string;
  email: string;
  name?: string;
  organizationId?: string;
  createdAt: number;
};

type HumanAuthContextValue = {
  user: HumanUser | null;
  sessionToken: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const HumanAuthContext = createContext<HumanAuthContextValue | undefined>(undefined);

export function HumanAuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionTokenState] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY) || "";
    setSessionTokenState(stored);
    setIsLoaded(true);
  }, []);

  const setSessionToken = (value: string) => {
    setSessionTokenState(value);
    if (typeof window === "undefined") return;
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const session = useQuery(
    api.humanAuth.getSession,
    isLoaded && sessionToken ? { sessionToken } : "skip"
  );

  const loginMutation = useMutation(api.humanAuth.login);
  const registerMutation = useMutation(api.humanAuth.register);
  const logoutMutation = useMutation(api.humanAuth.logout);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginMutation({ email, password });
    if (result.success) {
      setSessionToken(result.sessionToken);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [loginMutation]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const result = await registerMutation({ email, password, name });
    if (result.success) {
      setSessionToken(result.sessionToken);
      return { success: true };
    }
    return { success: false, error: result.error };
  }, [registerMutation]);

  const logout = useCallback(async () => {
    if (sessionToken) {
      await logoutMutation({ sessionToken });
    }
    setSessionToken("");
  }, [sessionToken, logoutMutation]);

  const user = session ? (session as unknown as HumanUser) : null;
  const isLoading = !isLoaded || (!!sessionToken && session === undefined);

  const contextValue = useMemo(
    () => ({
      user,
      sessionToken,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, sessionToken, isLoading, login, register, logout]
  );

  return (
    <HumanAuthContext.Provider value={contextValue}>
      {children}
    </HumanAuthContext.Provider>
  );
}

export function useHumanAuth() {
  const context = useContext(HumanAuthContext);
  if (!context) {
    throw new Error("useHumanAuth must be used within HumanAuthProvider");
  }
  return context;
}

