"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { config } from "@/config";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAnonymous: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  isAnonymous: true,
  login: async () => null,
  signup: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check existing session on mount
  useEffect(() => {
    const stored = localStorage.getItem("instigpt_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Login failed";
      setUser(data.user);
      localStorage.setItem("instigpt_user", JSON.stringify(data.user));
      return null;
    } catch {
      return "Could not connect to server";
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<string | null> => {
    try {
      const res = await fetch(`${config.apiUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Signup failed";
      setUser(data.user);
      localStorage.setItem("instigpt_user", JSON.stringify(data.user));
      return null;
    } catch {
      return "Could not connect to server";
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(`${config.apiUrl}/auth/logout`, { credentials: "include" }).catch(() => {});
    setUser(null);
    localStorage.removeItem("instigpt_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAnonymous: !user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
