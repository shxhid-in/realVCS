"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Butcher } from '../lib/types';
import { freshButchers as butchers } from '../lib/freshMockData';

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'admin';
}

interface AuthContextType {
  butcher: Butcher | null;
  admin: AdminUser | null;
  user: Butcher | AdminUser | null;
  login: (id: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshButcherData: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [butcher, setButcher] = useState<Butcher | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Admin user configuration
  const adminUser: AdminUser = {
    id: 'admin',
    username: 'admin',
    name: 'System Administrator',
    role: 'admin'
  };

  const user = butcher || admin;
  const isAdmin = !!admin;

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      const storedUserType = localStorage.getItem('userType');
      
      if (storedUser && storedUserType) {
        if (storedUserType === 'admin') {
          const parsedAdmin = JSON.parse(storedUser);
          setAdmin(parsedAdmin);
        } else if (storedUserType === 'butcher') {
          const parsedButcher = JSON.parse(storedUser);
          // Always use the latest menu data from mockData
          const latestButcherData = butchers.find(b => b.id === parsedButcher.id);
          if (latestButcherData) {
            setButcher(latestButcherData);
            // Update localStorage with latest data
            localStorage.setItem('user', JSON.stringify(latestButcherData));
          } else {
            setButcher(parsedButcher);
          }
        }
      }
    } catch (error) {
      console.error("Could not parse stored user data", error);
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (id: string, password: string): Promise<boolean> => {
    // Check for admin login
    if (id === 'admin' && password === 'admin') {
      setAdmin(adminUser);
      localStorage.setItem('user', JSON.stringify(adminUser));
      localStorage.setItem('userType', 'admin');
      router.push('/admin');
      return true;
    }
    
    // Check for butcher login
    const foundButcher = butchers.find(b => b.id === id && b.password === password);
    if (foundButcher) {
      setButcher(foundButcher);
      localStorage.setItem('user', JSON.stringify(foundButcher));
      localStorage.setItem('userType', 'butcher');
      router.push('/dashboard');
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setButcher(null);
    setAdmin(null);
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    router.push('/');
  };

  const refreshButcherData = () => {
    if (butcher) {
      // Force re-import of mock data to get latest changes
      import('../lib/freshMockData').then(({ freshButchers: latestButchers }) => {
        const latestButcherData = latestButchers.find(b => b.id === butcher.id);
        if (latestButcherData) {
          setButcher(latestButcherData);
          localStorage.setItem('user', JSON.stringify(latestButcherData));
        }
      });
    }
  };

  const value = { butcher, admin, user, login, logout, refreshButcherData, isAdmin };

  return (
    <AuthContext.Provider value={value}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
