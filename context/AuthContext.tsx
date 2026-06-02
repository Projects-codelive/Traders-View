"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AuthSession } from "@/lib/auth-types";
import { getSession, clearSession } from "@/lib/auth";

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  logout: () => void;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  logout: () => {},
  refresh: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setSession(getSession());
  }

  useEffect(() => {
    setSession(getSession());
    setLoading(false);
  }, []);

  function logout() {
    clearSession();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
