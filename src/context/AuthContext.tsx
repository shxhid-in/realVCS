"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Butcher } from '../lib/types';
import { freshButchers as butchers } from '../lib/butcherConfig';
import { decodeUserToken, isTokenExpired } from '../lib/auth/jwtClient';

// ✅ FIX: Helper to refresh token via API (client-side can't generate tokens)
async function refreshTokenFromAPI(token: string): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (response.ok) {
      const data = await response.json();
      return data.token || null;
    }
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

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
      // ✅ FIX: Check for stored user data first (more reliable for persistence)
      const storedUser = localStorage.getItem('user');
      const storedUserType = localStorage.getItem('userType');
      const token = localStorage.getItem('jwt_token');
      
      console.log('[Auth] Restoring session:', { hasStoredUser: !!storedUser, hasToken: !!token, userType: storedUserType });
      
      // ✅ FIX: If we have stored user data, restore session even if token is missing/expired
      if (storedUser && storedUserType) {
        console.log('[Auth] Restoring from stored user data');
        try {
          if (storedUserType === 'admin') {
            const parsedAdmin = JSON.parse(storedUser);
            setAdmin(adminUser);
            localStorage.setItem('user', JSON.stringify(adminUser));
            localStorage.setItem('userType', 'admin');
            // ✅ FIX: Refresh token if expired via API
            if (token && isTokenExpired(token)) {
              refreshTokenFromAPI(token).then(newToken => {
                if (newToken) {
                  localStorage.setItem('jwt_token', newToken);
                }
              }).catch(err => console.warn('Token refresh failed:', err));
            }
          } else if (storedUserType === 'butcher') {
            const parsedButcher = JSON.parse(storedUser);
            // Always use the latest menu data from mockData
            const latestButcherData = butchers.find(b => b.id === parsedButcher.id);
            if (latestButcherData) {
              setButcher(latestButcherData);
              localStorage.setItem('user', JSON.stringify(latestButcherData));
              localStorage.setItem('userType', 'butcher');
              // ✅ FIX: Refresh token if expired via API
              if (token && isTokenExpired(token)) {
                refreshTokenFromAPI(token).then(newToken => {
                  if (newToken) {
                    localStorage.setItem('jwt_token', newToken);
                  }
                }).catch(err => console.warn('Token refresh failed:', err));
              }
            } else {
              setButcher(parsedButcher);
            }
          }
        } catch (parseError) {
          console.error('Error parsing stored user:', parseError);
          // Clear invalid data
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user');
          localStorage.removeItem('userType');
        }
      } else if (token) {
        console.log('[Auth] Restoring from token only');
        // ✅ FIX: If only token exists (no stored user), decode and restore
        // Client-side: only decode payload, don't verify signature (server does that)
        const decoded = decodeUserToken(token);
        
        if (decoded) {
          // Check if token is expired
          const expired = isTokenExpired(token);
          
          if (decoded.role === 'admin') {
            setAdmin(adminUser);
            localStorage.setItem('user', JSON.stringify(adminUser));
            localStorage.setItem('userType', 'admin');
            // ✅ FIX: Token refresh happens server-side when needed
            // If expired, server will handle it on next API call
          } else {
            // Find butcher by ID from token
            const latestButcherData = butchers.find(b => b.id === decoded.butcherId);
            if (latestButcherData) {
              setButcher(latestButcherData);
              localStorage.setItem('user', JSON.stringify(latestButcherData));
              localStorage.setItem('userType', 'butcher');
              // ✅ FIX: Token refresh happens server-side when needed
              // If expired, server will handle it on next API call
            }
          }
        } else {
          // Token invalid, clear it
          localStorage.removeItem('jwt_token');
          localStorage.removeItem('user');
          localStorage.removeItem('userType');
        }
      }
      // ✅ FIX: No else needed - if we reach here, user is not logged in (no storedUser and no token)
    } catch (error) {
      console.error('Error loading auth state:', error);
      localStorage.removeItem('jwt_token');
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
      
      // ✅ FIX: Generate JWT token via API (client-side can't use Node.js crypto)
      try {
        const response = await fetch('/api/auth/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: adminUser.id,
            butcherId: '',
            name: adminUser.name,
            role: 'admin'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const token = data.token;
          
          // Store both JWT and user data
          localStorage.setItem('jwt_token', token);
          localStorage.setItem('user', JSON.stringify(adminUser));
          localStorage.setItem('userType', 'admin');
          
          router.push('/admin');
          return true;
        }
      } catch (error) {
        console.error('Error generating token:', error);
        return false;
      }
    }
    
    // Check for butcher login
    const foundButcher = butchers.find(b => b.id === id && b.password === password);
    if (foundButcher) {
      setButcher(foundButcher);
      
      // ✅ FIX: Generate JWT token via API (client-side can't use Node.js crypto)
      try {
        const response = await fetch('/api/auth/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: foundButcher.id,
            butcherId: foundButcher.id,
            name: foundButcher.name,
            role: 'butcher'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          const token = data.token;
          
          // Store both JWT and user data
          localStorage.setItem('jwt_token', token);
          localStorage.setItem('user', JSON.stringify(foundButcher));
          localStorage.setItem('userType', 'butcher');
          
          router.push('/dashboard');
          return true;
        }
      } catch (error) {
        console.error('Error generating token:', error);
        return false;
      }
    }
    
    return false;
  };

  const logout = () => {
    setButcher(null);
    setAdmin(null);
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    router.push('/');
  };

  const refreshButcherData = () => {
    if (butcher) {
      // Force re-import of mock data to get latest changes
      import('../lib/butcherConfig').then(({ freshButchers: latestButchers }) => {
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
