import { NextRequest, NextResponse } from 'next/server';
import { getAllOrdersFromCache } from '@/lib/orderCache';
import type { Order } from '@/lib/types';

/**
 * GET /api/orders-cache/[butcherId]
 * Get all orders from cache for a specific butcher
 * This replaces the polling-based order fetching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    
    if (!butcherId) {
      return NextResponse.json({ error: 'Butcher ID is required' }, { status: 400 });
    }

    // Get orders from cache
    const orders = getAllOrdersFromCache(butcherId);
    
    // Sort by order time (newest first)
    orders.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());
    
    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Error fetching orders from cache:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error.message },
      { status: 500 }
    );
  }
}

