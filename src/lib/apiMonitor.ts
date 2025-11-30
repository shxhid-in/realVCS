// API Usage Monitoring and Rate Limiting System
export interface ApiCall {
  id: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  status: number;
  duration: number;
  error?: string;
  quotaUsed?: number;
  sheetId?: string;
  sheetName?: string;
}

export interface ApiMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
  quotaExceededCount: number;
  callsPerMinute: number;
  callsPerHour: number;
  lastHour: ApiCall[];
  last24Hours: ApiCall[];
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  apiQuotaUsage: number;
  apiQuotaLimit: number;
  quotaPercentage: number;
  responseTime: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}

// In-memory storage for API calls (in production, use Redis or database)
let apiCalls: ApiCall[] = [];
let systemStartTime = new Date();

// Google Sheets API quota limits
const GOOGLE_SHEETS_QUOTA = {
  requestsPerMinute: 100,
  requestsPer100Seconds: 100,
  dailyQuota: 50000
};

export class ApiMonitor {
  private static instance: ApiMonitor;
  
  static getInstance(): ApiMonitor {
    if (!ApiMonitor.instance) {
      ApiMonitor.instance = new ApiMonitor();
    }
    return ApiMonitor.instance;
  }

  // Track an API call
  trackApiCall(call: Omit<ApiCall, 'id' | 'timestamp'>): void {
    const apiCall: ApiCall = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...call
    };

    apiCalls.push(apiCall);
    
    // Keep only last 24 hours of data
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    apiCalls = apiCalls.filter(call => call.timestamp > twentyFourHoursAgo);
  }

  // Get current API metrics
  getMetrics(): ApiMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    
    const lastHour = apiCalls.filter(call => call.timestamp > oneHourAgo);
    const lastMinute = apiCalls.filter(call => call.timestamp > oneMinuteAgo);
    
    const successfulCalls = apiCalls.filter(call => call.status >= 200 && call.status < 300).length;
    const failedCalls = apiCalls.filter(call => call.status >= 400).length;
    const quotaExceededCount = apiCalls.filter(call => call.status === 429).length;
    
    const totalDuration = apiCalls.reduce((sum, call) => sum + call.duration, 0);
    const averageResponseTime = apiCalls.length > 0 ? totalDuration / apiCalls.length : 0;

    return {
      totalCalls: apiCalls.length,
      successfulCalls,
      failedCalls,
      averageResponseTime,
      quotaExceededCount,
      callsPerMinute: lastMinute.length,
      callsPerHour: lastHour.length,
      lastHour,
      last24Hours: apiCalls
    };
  }

  // Get system health status
  getSystemHealth(): SystemHealth {
    const metrics = this.getMetrics();
    const now = new Date();
    
    // Calculate quota usage (estimate based on calls per minute)
    const quotaUsage = Math.min(metrics.callsPerMinute, GOOGLE_SHEETS_QUOTA.requestsPerMinute);
    const quotaPercentage = (quotaUsage / GOOGLE_SHEETS_QUOTA.requestsPerMinute) * 100;
    
    // Calculate error rate
    const errorRate = metrics.totalCalls > 0 ? (metrics.failedCalls / metrics.totalCalls) * 100 : 0;
    
    // Calculate uptime
    const uptime = now.getTime() - systemStartTime.getTime();
    
    // Determine system status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (quotaPercentage > 90 || errorRate > 20 || metrics.quotaExceededCount > 0) {
      status = 'critical';
    } else if (quotaPercentage > 70 || errorRate > 10 || metrics.averageResponseTime > 2000) {
      status = 'warning';
    }

    return {
      status,
      apiQuotaUsage: quotaUsage,
      apiQuotaLimit: GOOGLE_SHEETS_QUOTA.requestsPerMinute,
      quotaPercentage,
      responseTime: metrics.averageResponseTime,
      errorRate,
      uptime,
      lastUpdated: now
    };
  }

  // Get API calls for a specific time range
  getCallsInRange(startTime: Date, endTime: Date): ApiCall[] {
    return apiCalls.filter(call => 
      call.timestamp >= startTime && call.timestamp <= endTime
    );
  }

  // Get calls grouped by endpoint
  getCallsByEndpoint(): { [endpoint: string]: ApiCall[] } {
    const grouped: { [endpoint: string]: ApiCall[] } = {};
    
    apiCalls.forEach(call => {
      if (!grouped[call.endpoint]) {
        grouped[call.endpoint] = [];
      }
      grouped[call.endpoint].push(call);
    });
    
    return grouped;
  }

  // Get calls grouped by Google Sheet
  getCallsBySheet(): { [sheetName: string]: ApiCall[] } {
    const grouped: { [sheetName: string]: ApiCall[] } = {};
    
    apiCalls.forEach(call => {
      const sheetName = call.sheetName || 'Unknown';
      if (!grouped[sheetName]) {
        grouped[sheetName] = [];
      }
      grouped[sheetName].push(call);
    });
    
    return grouped;
  }

  // Get sheet-specific metrics
  getSheetMetrics(): Array<{
    sheetName: string;
    sheetId?: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    quotaExceededCount: number;
    averageResponseTime: number;
    callsPerMinute: number;
    callsPerHour: number;
    successRate: number;
    lastCall?: Date;
  }> {
    const sheetGroups = this.getCallsBySheet();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    
    return Object.entries(sheetGroups).map(([sheetName, calls]) => {
      const lastHour = calls.filter(call => call.timestamp > oneHourAgo);
      const lastMinute = calls.filter(call => call.timestamp > oneMinuteAgo);
      
      const successfulCalls = calls.filter(call => call.status >= 200 && call.status < 300).length;
      const failedCalls = calls.filter(call => call.status >= 400).length;
      const quotaExceededCount = calls.filter(call => call.status === 429).length;
      
      const totalDuration = calls.reduce((sum, call) => sum + call.duration, 0);
      const averageResponseTime = calls.length > 0 ? totalDuration / calls.length : 0;
      
      const successRate = calls.length > 0 ? (successfulCalls / calls.length) * 100 : 0;
      
      // Get the most recent call to extract sheetId
      const mostRecentCall = calls.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
      
      return {
        sheetName,
        sheetId: mostRecentCall?.sheetId,
        totalCalls: calls.length,
        successfulCalls,
        failedCalls,
        quotaExceededCount,
        averageResponseTime: Math.round(averageResponseTime),
        callsPerMinute: lastMinute.length,
        callsPerHour: lastHour.length,
        successRate: Math.round(successRate * 10) / 10,
        lastCall: mostRecentCall?.timestamp
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }

  // Get hourly breakdown for the last 24 hours
  getHourlyBreakdown(): Array<{
    hour: string;
    calls: number;
    errors: number;
    averageResponseTime: number;
  }> {
    const now = new Date();
    const breakdown: Array<{
      hour: string;
      calls: number;
      errors: number;
      averageResponseTime: number;
    }> = [];

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const hourCalls = this.getCallsInRange(hourStart, hourEnd);
      const errors = hourCalls.filter(call => call.status >= 400).length;
      const totalDuration = hourCalls.reduce((sum, call) => sum + call.duration, 0);
      const averageResponseTime = hourCalls.length > 0 ? totalDuration / hourCalls.length : 0;

      breakdown.push({
        hour: hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        calls: hourCalls.length,
        errors,
        averageResponseTime
      });
    }

    return breakdown;
  }

  // Clear old data (for maintenance)
  clearOldData(): void {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    apiCalls = apiCalls.filter(call => call.timestamp > twentyFourHoursAgo);
  }

  // Reset system start time (for testing)
  resetSystemStartTime(): void {
    systemStartTime = new Date();
  }
}

// Middleware function to track API calls
export function trackApiCall(
  endpoint: string,
  method: string,
  status: number,
  duration: number,
  error?: string,
  sheetInfo?: { sheetId?: string; sheetName?: string }
): void {
  const monitor = ApiMonitor.getInstance();
  monitor.trackApiCall({
    endpoint,
    method,
    status,
    duration,
    error,
    sheetId: sheetInfo?.sheetId,
    sheetName: sheetInfo?.sheetName
  });
}

// Helper function to measure API call duration
export function measureApiCall<T>(
  endpoint: string,
  method: string,
  apiFunction: () => Promise<T>,
  sheetInfo?: { sheetId?: string; sheetName?: string }
): Promise<T> {
  const startTime = Date.now();
  
  return apiFunction()
    .then(result => {
      const duration = Date.now() - startTime;
      trackApiCall(endpoint, method, 200, duration, undefined, sheetInfo);
      return result;
    })
    .catch(error => {
      const duration = Date.now() - startTime;
      const status = error.status || error.code || 500;
      trackApiCall(endpoint, method, status, duration, error.message, sheetInfo);
      throw error;
    });
}

// Export singleton instance
export const apiMonitor = ApiMonitor.getInstance();
