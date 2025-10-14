import { NextRequest, NextResponse } from 'next/server';
import { getSalesDataFromSheet, calculateWeeklyTargets } from '@/lib/salesSheets';

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== DAM SALES API CALLED (UPDATED VERSION) ===');
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '1');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    console.log('Fetching sales data for:', { month, year });
    console.log('Calling getSalesDataFromSheet with enhanced logging...');
    const salesData = await getSalesDataFromSheet(month, year);
    console.log('Sales data result:', salesData.length, 'entries');
    
    // Log first few sales data entries for debugging
    if (salesData.length > 0) {
      console.log('First sales data entry:', {
        orderId: salesData[0].orderId,
        butcherId: salesData[0].butcherId,
        salesRevenue: salesData[0].salesRevenue,
        butcherRevenue: salesData[0].butcherRevenue,
        margin: salesData[0].margin,
        orderDate: salesData[0].orderDate
      });
    }
    
    const butcherSummary = calculateButcherSummary(salesData);
    console.log('Butcher summary:', butcherSummary.length, 'butchers');
    
    // Calculate weekly targets
    console.log('Calling calculateWeeklyTargets with enhanced logging...');
    const weeklyTargets = await calculateWeeklyTargets(month, year);
    console.log('Weekly targets:', weeklyTargets.length, 'weeks');
    
    // Log weekly targets for debugging
    weeklyTargets.forEach(week => {
      console.log(`Week ${week.week}: target=${week.target}, achieved=${week.achieved}, percentage=${week.percentage}`);
    });
    
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
