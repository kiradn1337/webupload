import React, { createContext, useState, useEffect } from 'react';
import jwt_decode from 'jwt-decode';
import { api } from '../api';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize auth state from token in localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      
      if (storedToken) {
        try {
          // Validate token and extract user data
          const decoded: any = jwt_decode(storedToken);
          
          // Check if token is expired
          if (decoded.exp * 1000 < Date.now()) {
            // Token expired, try to refresh
            const refreshed = await refreshToken();
            if (!refreshed) {
              await logout();
            }
          } else {
            // Set up API authorization header
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            
            // Set user from decoded token
            setUser({
              id: decoded.id,
              email: decoded.email,
              role: decoded.role,
              emailVerified: decoded.emailVerified,
            });
            setToken(storedToken);
          }
        } catch (error) {
          // Invalid token
          await logout();
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('accessToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      setToken(token);
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    
    try {
      const response = await api.post('/auth/register', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('accessToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      setToken(token);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      delete api.defaults.headers.common['Authorization'];
      
      setUser(null);
      setToken(null);
      setIsLoading(false);
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await api.post('/auth/refresh');
      const { token, user } = response.data;
      
      localStorage.setItem('accessToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(user);
      setToken(token);
      
      return true;
    } catch (error) {
      return false;
    }
  };

  // Context value
  const contextValue: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};
