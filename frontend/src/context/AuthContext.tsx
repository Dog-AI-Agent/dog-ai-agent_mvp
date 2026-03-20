import React, { createContext, useCallback, useContext, useState } from "react";
import { Platform } from "react-native";
import { setAuthToken } from "../api/tokenStore";

export interface AuthUser {
  user_id: string;
  name: string;
  email: string;
  nickname: string;
  birth_date?: string | null;
  address?: string | null;
  created_at: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
});

const storage = {
  get: (key: string): string | null => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      return localStorage.getItem(key);
    }
    return null;
  },
  set: (key: string, value: string) => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  },
  remove: (key: string) => {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem(key);
    }
  },
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    const t = storage.get(AUTH_TOKEN_KEY);
    setAuthToken(t);
    return t;
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = storage.get(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    setAuthToken(newToken);
    storage.set(AUTH_TOKEN_KEY, newToken);
    storage.set(AUTH_USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    storage.remove(AUTH_TOKEN_KEY);
    storage.remove(AUTH_USER_KEY);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    setUser(updatedUser);
    storage.set(AUTH_USER_KEY, JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
