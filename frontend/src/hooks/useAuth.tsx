import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

const AUTH_TOKEN_KEY = 'authToken';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  const login = (token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
