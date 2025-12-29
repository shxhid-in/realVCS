/**
 * Rate limiter for Zoho API requests
 * Prevents exceeding Zoho's rate limits
 */

interface RequestRecord {
  timestamp: number;
  count: number;
}

class ZohoRateLimiter {
  private requestHistory: RequestRecord[] = [];
  private readonly MAX_REQUESTS_PER_MINUTE = 50; // Conservative limit (Zoho allows ~100/min)
  private readonly MAX_REQUESTS_PER_HOUR = 5000; // Conservative limit (Zoho allows ~10k/day)
  private readonly WINDOW_MS = 60 * 1000; // 1 minute window
  private readonly HOUR_WINDOW_MS = 60 * 60 * 1000; // 1 hour window

  /**
   * Check if a request can be made
   */
  canMakeRequest(): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    
    // Clean up old records (older than 1 hour)
    this.requestHistory = this.requestHistory.filter(
      record => now - record.timestamp < this.HOUR_WINDOW_MS
    );
    
    // Count requests in the last minute
    const recentRequests = this.requestHistory.filter(
      record => now - record.timestamp < this.WINDOW_MS
    );
    const requestsInLastMinute = recentRequests.reduce(
      (sum, record) => sum + record.count,
      0
    );
    
    // Count requests in the last hour
    const requestsInLastHour = this.requestHistory.reduce(
      (sum, record) => sum + record.count,
      0
    );
    
    // Check limits
    if (requestsInLastMinute >= this.MAX_REQUESTS_PER_MINUTE) {
      // Calculate when the oldest request in the window will expire
      const oldestInWindow = Math.min(
        ...recentRequests.map(r => r.timestamp)
      );
      const retryAfter = Math.ceil(
        (oldestInWindow + this.WINDOW_MS - now) / 1000
      );
      return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }
    
    if (requestsInLastHour >= this.MAX_REQUESTS_PER_HOUR) {
      // Calculate when the oldest request will expire
      const oldest = Math.min(...this.requestHistory.map(r => r.timestamp));
      const retryAfter = Math.ceil(
        (oldest + this.HOUR_WINDOW_MS - now) / 1000
      );
      return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }
    
    return { allowed: true };
  }

  /**
   * Record a request
   */
  recordRequest(): void {
    const now = Date.now();
    
    // Try to merge with existing record in the same second
    const existingIndex = this.requestHistory.findIndex(
      record => Math.abs(now - record.timestamp) < 1000
    );
    
    if (existingIndex >= 0) {
      this.requestHistory[existingIndex].count++;
    } else {
      this.requestHistory.push({
        timestamp: now,
        count: 1
      });
    }
    
    // Keep only last hour of history
    this.requestHistory = this.requestHistory.filter(
      record => now - record.timestamp < this.HOUR_WINDOW_MS
    );
  }

  /**
   * Record a rate limit error (429)
   */
  recordRateLimit(): void {
    // When we hit rate limit, add a penalty to slow down
    // Add multiple records to simulate hitting the limit
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      this.requestHistory.push({
        timestamp: now - (i * 1000), // Spread over last 5 seconds
        count: 1
      });
    }
  }

  /**
   * Reset rate limiter (for testing)
   */
  reset(): void {
    this.requestHistory = [];
  }

  /**
   * Get current statistics
   */
  getStats(): {
    requestsInLastMinute: number;
    requestsInLastHour: number;
    canMakeRequest: boolean;
  } {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(
      record => now - record.timestamp < this.WINDOW_MS
    );
    const requestsInLastMinute = recentRequests.reduce(
      (sum, record) => sum + record.count,
      0
    );
    const requestsInLastHour = this.requestHistory.reduce(
      (sum, record) => sum + record.count,
      0
    );
    const { allowed } = this.canMakeRequest();
    
    return {
      requestsInLastMinute,
      requestsInLastHour,
      canMakeRequest: allowed
    };
  }
}

// Singleton instance
let rateLimiterInstance: ZohoRateLimiter | null = null;

export function getZohoRateLimiter(): ZohoRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new ZohoRateLimiter();
  }
  return rateLimiterInstance;
}

export default getZohoRateLimiter;

