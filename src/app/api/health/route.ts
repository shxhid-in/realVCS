import { NextResponse } from 'next/server';
import { apiMonitor } from '@/lib/apiMonitor';
// Import menu update worker to ensure it starts
import '@/lib/menuUpdateWorker';

export async function GET() {
  try {
    const systemHealth = apiMonitor.getSystemHealth();
    const metrics = apiMonitor.getMetrics();
    
    return NextResponse.json({ 
      status: systemHealth.status,
      timestamp: new Date().toISOString(),
      service: 'Bezgo Fresh POS System',
      health: systemHealth,
      metrics: {
        totalApiCalls: metrics.totalCalls,
        successfulCalls: metrics.successfulCalls,
        failedCalls: metrics.failedCalls,
        averageResponseTime: Math.round(metrics.averageResponseTime),
        quotaExceededCount: metrics.quotaExceededCount,
        callsPerMinute: metrics.callsPerMinute,
        callsPerHour: metrics.callsPerHour
      },
      googleSheetsQuota: {
        currentUsage: systemHealth.apiQuotaUsage,
        limit: systemHealth.apiQuotaLimit,
        percentage: Math.round(systemHealth.quotaPercentage),
        status: systemHealth.quotaPercentage > 90 ? 'critical' : 
                systemHealth.quotaPercentage > 70 ? 'warning' : 'healthy'
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'Bezgo Fresh POS System',
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}