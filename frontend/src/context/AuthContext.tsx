import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';
import type { TokenResponse, User } from '../types';

// TOKEN PERSISTENCE SECURITY TRADEOFF RATIONALE:
// - `refresh_token` is persisted in `localStorage` so that user sessions survive browser reloads
//   without forcing the user to log in again on every tab navigation.
// - `access_token` is kept strictly in in-memory React state (AuthContext) rather than `localStorage`.
//   Because `access_token` is attached to every outgoing HTTP request header, storing it in memory
//   minimizes the security exposure window against XSS scripts attempting to exfiltrate active bearer tokens.
//   When memory state is reset (e.g. on page refresh), the persisted `refresh_token` is safely exchanged
//   for a new short-lived `access_token` via the `/auth/refresh` endpoint during initial session setup.

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  role: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level token holder for Axios interceptor access
let inMemoryAccessToken: string | null = null;

export const getInMemoryAccessToken = (): string | null => inMemoryAccessToken;
export const setInMemoryAccessToken = (token: string | null): void => {
  inMemoryAccessToken = token;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('refresh_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateTokens = (tokens: TokenResponse) => {
    setInMemoryAccessToken(tokens.access_token);
    setAccessTokenState(tokens.access_token);
    setRefreshToken(tokens.refresh_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
  };

  const clearAuth = () => {
    setInMemoryAccessToken(null);
    setAccessTokenState(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('refresh_token');
  };

  const fetchUserProfile = async (token: string): Promise<User> => {
    const res = await apiClient.get<User>('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  };

  // Restore session on app load if refresh_token exists
  useEffect(() => {
    const restoreSession = async () => {
      const storedRefreshToken = localStorage.getItem('refresh_token');
      if (!storedRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const refreshRes = await apiClient.post<TokenResponse>('/api/v1/auth/refresh', {
          refresh_token: storedRefreshToken,
        });

        const newTokens = refreshRes.data;
        updateTokens(newTokens);

        const profile = await fetchUserProfile(newTokens.access_token);
        setUser(profile);
      } catch (err) {
        console.warn('Session restoration failed:', err);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const res = await apiClient.post<TokenResponse>('/api/v1/auth/login', { email, password });
    const tokens = res.data;
    updateTokens(tokens);

    const profile = await fetchUserProfile(tokens.access_token);
    setUser(profile);
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    phone?: string
  ): Promise<void> => {
    const payload: { email: string; password: string; name: string; phone?: string } = {
      email,
      password,
      name,
    };
    if (phone && phone.trim()) {
      payload.phone = phone.trim();
    }

    const res = await apiClient.post<TokenResponse>('/api/v1/auth/register', payload);
    const tokens = res.data;
    updateTokens(tokens);

    const profile = await fetchUserProfile(tokens.access_token);
    setUser(profile);
  };

  const logout = (): void => {
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isLoading,
        role: user?.role || null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
