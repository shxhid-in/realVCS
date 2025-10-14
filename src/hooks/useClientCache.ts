"use client";

import { useRef, useCallback } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export const useClientCache = () => {
  const cache = useRef(new Map<string, CacheItem<any>>());

  const set = useCallback(<T>(key: string, data: T, ttlMs: number = 30000) => {
    cache.current.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }, []);

  const get = useCallback(<T>(key: string): T | null => {
    const item = cache.current.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      cache.current.delete(key);
      return null;
    }

    return item.data as T;
  }, []);

  const clear = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);

  return { set, get, clear };
};
