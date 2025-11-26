import { NextRequest, NextResponse } from 'next/server';
import { getSalesDataFromSheet, calculateWeeklyTargets } from '@/lib/salesSheets';

const SALES_DATA_PER_PAGE = 100;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '1');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Fetch all sales data from sheet (filtered by month/year)
    const allSalesData = await getSalesDataFromSheet(month, year);
    
    // Calculate pagination
    const totalCount = allSalesData.length;
    const totalPages = Math.ceil(totalCount / SALES_DATA_PER_PAGE);
    const startIndex = (page - 1) * SALES_DATA_PER_PAGE;
    const endIndex = startIndex + SALES_DATA_PER_PAGE;
    const paginatedSalesData = allSalesData.slice(startIndex, endIndex);
    const hasMore = page < totalPages;
    
    // Calculate butcher summary from ALL data (not just paginated)
    const butcherSummary = calculateButcherSummary(allSalesData);
    
    // Calculate weekly targets
    const weeklyTargets = await calculateWeeklyTargets(month, year);
    
    
    return NextResponse.json({
      salesData: paginatedSalesData,
      butcherSummary,
      weeklyTargets,
      pagination: {
        page,
        pageSize: SALES_DATA_PER_PAGE,
        totalCount,
        totalPages,
        hasMore
      }
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
