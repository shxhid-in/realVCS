// Simple in-memory cache for Google Sheets data
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();

  set<T>(key: string, data: T, ttlMs: number = 300000): void { // Default 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache stats
  getStats() {
    const now = Date.now();
    const validEntries = Array.from(this.cache.entries()).filter(
      ([_, item]) => now - item.timestamp <= item.ttl
    );
    
    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries: this.cache.size - validEntries.length
    };
  }
}

// Global cache instance
export const sheetsCache = new SimpleCache();

// Cache keys
export const CACHE_KEYS = {
  ORDERS: (butcherId: string) => `orders_${butcherId}`,
  MENU: (butcherId: string) => `menu_${butcherId}`,
  EARNINGS: (butcherId: string) => `earnings_${butcherId}`,
} as const;
