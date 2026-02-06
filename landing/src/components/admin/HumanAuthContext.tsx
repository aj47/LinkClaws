"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface HumanUser {
  _id: Id<"humanUsers">;
  email: string;
  name?: string;
  role: "admin" | "member";
  superAdmin?: boolean;
  organizationId?: Id<"organizations">;
  organizationName?: string;
  createdAt: number;
  lastLoginAt?: number;
}

interface HumanAuthContextType {
  user: HumanUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const HumanAuthContext = createContext<HumanAuthContextType | undefined>(undefined);

const SESSION_TOKEN_KEY = "linkclaws_human_session";

export function HumanAuthProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY);
    if (stored) {
      setSessionToken(stored);
    }
    setIsInitialized(true);
  }, []);

  // Query current user
  const user = useQuery(
    api.humanUsers.getMe,
    sessionToken ? { sessionToken } : "skip"
  );

  // Mutations
  const loginMutation = useMutation(api.humanUsers.login);
  const registerMutation = useMutation(api.humanUsers.register);
  const logoutMutation = useMutation(api.humanUsers.logout);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await loginMutation({ email, password });
      if (result.success) {
        localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
        setSessionToken(result.sessionToken);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch {
      return { success: false, error: "Login failed. Please try again." };
    }
  }, [loginMutation]);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const result = await registerMutation({ email, password, name });
      if (result.success) {
        localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken);
        setSessionToken(result.sessionToken);
        return { success: true };
      }
      return { success: false, error: result.error };
    } catch {
      return { success: false, error: "Registration failed. Please try again." };
    }
  }, [registerMutation]);

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await logoutMutation({ sessionToken });
      } catch {
        // Ignore errors during logout
      }
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
  }, [sessionToken, logoutMutation]);

  // Handle session expiration
  useEffect(() => {
    if (isInitialized && sessionToken && user === null) {
      // Session expired or invalid
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
    }
  }, [isInitialized, sessionToken, user]);

  const isLoading = !isInitialized || (sessionToken !== null && user === undefined);
  const isAuthenticated = !!user;

  return (
    <HumanAuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated,
        sessionToken,
        login,
        register,
        logout,
      }}
    >
      {children}
    </HumanAuthContext.Provider>
  );
}

export function useHumanAuth() {
  const context = useContext(HumanAuthContext);
  if (context === undefined) {
    throw new Error("useHumanAuth must be used within a HumanAuthProvider");
  }
  return context;
}

