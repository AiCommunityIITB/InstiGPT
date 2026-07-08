"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { api } from "@/lib/api";
import { config } from "@/config";
import type { User } from "@instigpt/shared";

// ─── Mock user for development ───
const DEV_USER: User = {
  id: "dev-001",
  username: "devuser",
  name: "Dev User",
  email: "dev@iitb.ac.in",
  roll_number: "210070042",
  department: "Computer Science & Engineering",
  year: 2021,
  program: "BTech",
  created_at: new Date().toISOString(),
};

interface AuthState {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    // In dev mode, auto-login with mock user
    if (config.isDev) {
      setUser(DEV_USER);
      setIsLoading(false);
      return;
    }

    try {
      const { user } = await api.auth.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    if (!config.isDev) {
      await api.auth.logout();
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
