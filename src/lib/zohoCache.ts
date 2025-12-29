/**
 * Server-side cache for Zoho API responses
 * Prevents duplicate API calls and reduces rate limiting issues
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class ZohoCache {
  private invoicesCache = new Map<string, CacheEntry<any[]>>();
  private paymentsCache = new Map<string, CacheEntry<any[]>>();
  private invoiceDetailsCache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, PendingRequest<any>>();
  
  // Cache duration: 5 minutes (300000ms)
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  
  // Cleanup interval: every 10 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup of expired entries
    this.startCleanup();
  }

  /**
   * Get cache key for invoices by date
   */
  private getInvoicesKey(date: string): string {
    return `invoices:${date}`;
  }

  /**
   * Get cache key for payments by date
   */
  private getPaymentsKey(date: string, all?: boolean): string {
    return `payments:${date || 'all'}:${all ? 'all' : 'date'}`;
  }

  /**
   * Get cache key for invoice details
   */
  private getInvoiceDetailsKey(invoiceId: string): string {
    return `invoice:${invoiceId}`;
  }

  /**
   * Get cached invoices for a date
   */
  getInvoices(date: string): any[] | null {
    const key = this.getInvoicesKey(date);
    const entry = this.invoicesCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.invoicesCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached invoices for a date
   */
  setInvoices(date: string, data: any[]): void {
    const key = this.getInvoicesKey(date);
    const now = Date.now();
    
    this.invoicesCache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION
    });
  }

  /**
   * Get cached payments for a date
   */
  getPayments(date: string | null, all?: boolean): any[] | null {
    const key = this.getPaymentsKey(date || '', all);
    const entry = this.paymentsCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.paymentsCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached payments for a date
   */
  setPayments(date: string | null, all: boolean | undefined, data: any[]): void {
    const key = this.getPaymentsKey(date || '', all);
    const now = Date.now();
    
    this.paymentsCache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION
    });
  }

  /**
   * Get cached invoice details
   */
  getInvoiceDetails(invoiceId: string): any | null {
    const key = this.getInvoiceDetailsKey(invoiceId);
    const entry = this.invoiceDetailsCache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.invoiceDetailsCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set cached invoice details
   */
  setInvoiceDetails(invoiceId: string, data: any): void {
    const key = this.getInvoiceDetailsKey(invoiceId);
    const now = Date.now();
    
    this.invoiceDetailsCache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION
    });
  }

  /**
   * Get or create a pending request (for deduplication)
   */
  getOrCreatePendingRequest<T>(
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    // Check if there's already a pending request
    const pending = this.pendingRequests.get(key);
    if (pending) {
      // Check if it's still recent (within 30 seconds)
      if (Date.now() - pending.timestamp < 30000) {
        return pending.promise;
      }
      // Remove stale pending request
      this.pendingRequests.delete(key);
    }

    // Create new pending request
    const promise = factory().finally(() => {
      // Remove from pending after completion (with delay to allow concurrent requests to join)
      setTimeout(() => {
        this.pendingRequests.delete(key);
      }, 1000);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * Invalidate cache for a specific date
   */
  invalidateInvoices(date: string): void {
    const key = this.getInvoicesKey(date);
    this.invoicesCache.delete(key);
  }

  /**
   * Invalidate cache for payments
   */
  invalidatePayments(date: string | null, all?: boolean): void {
    const key = this.getPaymentsKey(date || '', all);
    this.paymentsCache.delete(key);
  }

  /**
   * Invalidate invoice details cache
   */
  invalidateInvoiceDetails(invoiceId: string): void {
    const key = this.getInvoiceDetailsKey(invoiceId);
    this.invoiceDetailsCache.delete(key);
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.invoicesCache.clear();
    this.paymentsCache.clear();
    this.invoiceDetailsCache.clear();
    this.pendingRequests.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Cleanup invoices cache
    for (const [key, entry] of this.invoicesCache.entries()) {
      if (now > entry.expiresAt) {
        this.invoicesCache.delete(key);
      }
    }
    
    // Cleanup payments cache
    for (const [key, entry] of this.paymentsCache.entries()) {
      if (now > entry.expiresAt) {
        this.paymentsCache.delete(key);
      }
    }
    
    // Cleanup invoice details cache
    for (const [key, entry] of this.invoiceDetailsCache.entries()) {
      if (now > entry.expiresAt) {
        this.invoiceDetailsCache.delete(key);
      }
    }
    
    // Cleanup stale pending requests (older than 1 minute)
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > 60000) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    // Cleanup every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 10 * 60 * 1000);
  }

  /**
   * Stop cleanup (for testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    invoices: number;
    payments: number;
    invoiceDetails: number;
    pendingRequests: number;
  } {
    return {
      invoices: this.invoicesCache.size,
      payments: this.paymentsCache.size,
      invoiceDetails: this.invoiceDetailsCache.size,
      pendingRequests: this.pendingRequests.size
    };
  }
}

// Singleton instance
let cacheInstance: ZohoCache | null = null;

export function getZohoCache(): ZohoCache {
  if (!cacheInstance) {
    cacheInstance = new ZohoCache();
  }
  return cacheInstance;
}

export default getZohoCache;

