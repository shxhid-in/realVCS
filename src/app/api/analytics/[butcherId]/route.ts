import { NextRequest, NextResponse } from 'next/server';
import { getOrdersFromSheet } from '@/lib/sheets';
import { verifyUserToken } from '@/lib/auth/jwt';

const ORDERS_PER_PAGE = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyUserToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }

    // Check if user has access to this butcher's data
    if (decoded.role !== 'admin' && decoded.butcherId !== butcherId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch all orders from sheet
    const allOrders = await getOrdersFromSheet(butcherId);

    // Calculate pagination
    const totalCount = allOrders.length;
    const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);
    const startIndex = (page - 1) * ORDERS_PER_PAGE;
    const endIndex = startIndex + ORDERS_PER_PAGE;
    const paginatedOrders = allOrders.slice(startIndex, endIndex);
    const hasMore = page < totalPages;

    return NextResponse.json({
      orders: paginatedOrders,
      pagination: {
        page,
        pageSize: ORDERS_PER_PAGE,
        totalCount,
        totalPages,
        hasMore
      }
    });

  } catch (error: any) {
    console.error('Error fetching analytics data:', error);
    
    // Check for quota exceeded errors
    if (error.status === 429 || error.message?.includes('Quota exceeded') || error.message?.includes('quota')) {
      return NextResponse.json(
        { 
          error: 'Quota exceeded', 
          message: 'Google Sheets API quota exceeded. Please wait a minute and try again.' 
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch analytics data', 
        message: error.message || 'Try again later' 
      },
      { status: 500 }
    );
  }
}

