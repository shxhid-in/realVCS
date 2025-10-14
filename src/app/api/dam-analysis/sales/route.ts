import { NextRequest, NextResponse } from 'next/server';
import { getSalesDataFromSheet, calculateWeeklyTargets } from '@/lib/salesSheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '1');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    const salesData = await getSalesDataFromSheet(month, year);
    
    
    const butcherSummary = calculateButcherSummary(salesData);
    
    // Calculate weekly targets
    const weeklyTargets = await calculateWeeklyTargets(month, year);
    
    
    return NextResponse.json({
      salesData,
      butcherSummary,
      weeklyTargets
    });
  } catch (error) {
    console.error('Error fetching DAM sales data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function calculateButcherSummary(salesData: any[]) {
  const butcherMap = new Map();
  
  salesData.forEach(order => {
    if (!butcherMap.has(order.butcherId)) {
      butcherMap.set(order.butcherId, {
        butcherId: order.butcherId,
        butcherName: order.butcherName,
        totalSales: 0,
        totalRevenue: 0,
        totalMargin: 0,
        orderCount: 0
      });
    }
    
    const butcher = butcherMap.get(order.butcherId);
    butcher.totalSales += order.salesRevenue || 0;
    butcher.totalRevenue += order.butcherRevenue || 0;
    butcher.totalMargin += order.margin || 0;
    butcher.orderCount += 1;
  });
  
  return Array.from(butcherMap.values());
}
