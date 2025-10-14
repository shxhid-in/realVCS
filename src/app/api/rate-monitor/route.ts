import { NextResponse } from 'next/server';
import { apiMonitor } from '@/lib/apiMonitor';

export async function GET() {
  try {
    const systemHealth = apiMonitor.getSystemHealth();
    const metrics = apiMonitor.getMetrics();
    const hourlyBreakdown = apiMonitor.getHourlyBreakdown();
    const callsByEndpoint = apiMonitor.getCallsByEndpoint();
    const sheetMetrics = apiMonitor.getSheetMetrics();
    
    // Calculate endpoint statistics
    const endpointStats = Object.entries(callsByEndpoint).map(([endpoint, calls]) => {
      const totalCalls = calls.length;
      const successfulCalls = calls.filter(call => call.status >= 200 && call.status < 300).length;
      const failedCalls = calls.filter(call => call.status >= 400).length;
      const averageResponseTime = calls.reduce((sum, call) => sum + call.duration, 0) / totalCalls;
      const quotaExceeded = calls.filter(call => call.status === 429).length;
      
      return {
        endpoint,
        totalCalls,
        successfulCalls,
        failedCalls,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
        averageResponseTime: Math.round(averageResponseTime),
        quotaExceeded
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);

    // Get recent errors
    const recentErrors = metrics.last24Hours
      .filter(call => call.status >= 400)
      .slice(-10) // Last 10 errors
      .map(call => ({
        timestamp: call.timestamp,
        endpoint: call.endpoint,
        method: call.method,
        status: call.status,
        error: call.error,
        duration: call.duration
      }));

    return NextResponse.json({
      systemHealth,
      metrics: {
        ...metrics,
        // Don't send full call arrays to reduce payload size
        lastHour: metrics.lastHour.length,
        last24Hours: metrics.last24Hours.length
      },
      hourlyBreakdown,
      endpointStats,
      sheetMetrics,
      recentErrors,
      quotaInfo: {
        googleSheetsLimits: {
          requestsPerMinute: 100,
          requestsPer100Seconds: 100,
          dailyQuota: 50000
        },
        currentUsage: {
          perMinute: metrics.callsPerMinute,
          perHour: metrics.callsPerHour,
          percentage: systemHealth.quotaPercentage
        },
        recommendations: getQuotaRecommendations(systemHealth, metrics)
      },
      sheetsInfo: {
        butcherPosSheet: {
          name: 'Butcher POS Sheet',
          description: 'Main order management and butcher operations',
          envVar: 'BUTCHER_POS_SHEET_ID'
        },
        menuPosSheet: {
          name: 'Menu POS Sheet', 
          description: 'Menu items, pricing, and inventory',
          envVar: 'MENU_POS_SHEET_ID'
        },
        salesVcsSheet: {
          name: 'Sales VCS Sheet',
          description: 'Sales data and revenue tracking',
          envVar: 'SALES_VCS_SPREADSHEET_ID'
        },
        supportSheet: {
          name: 'Support Sheet',
          description: 'Customer support requests and communications',
          envVar: 'SUPPORT_SHEET_ID'
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch rate monitoring data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getQuotaRecommendations(health: any, metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (health.quotaPercentage > 90) {
    recommendations.push('Critical: API quota usage is very high. Consider implementing request batching.');
    recommendations.push('Increase caching duration to reduce API calls.');
  } else if (health.quotaPercentage > 70) {
    recommendations.push('Warning: API quota usage is elevated. Monitor closely.');
    recommendations.push('Consider optimizing polling intervals.');
  }
  
  if (health.errorRate > 10) {
    recommendations.push('High error rate detected. Check Google Sheets connectivity.');
  }
  
  if (metrics.quotaExceededCount > 0) {
    recommendations.push('Quota exceeded errors detected. Implement exponential backoff.');
  }
  
  if (health.responseTime > 2000) {
    recommendations.push('High response times detected. Check network connectivity.');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System is operating normally.');
  }
  
  return recommendations;
}
