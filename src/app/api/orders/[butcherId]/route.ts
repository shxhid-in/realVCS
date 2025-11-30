import { NextRequest, NextResponse } from 'next/server';
import { getAllOrdersFromCache } from '../../../../lib/orderCache';
import { saveOrderToSheet, updateOrderInSheet } from '../../../../lib/sheets';
import type { Order } from '../../../../lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    
    if (!butcherId) {
      return NextResponse.json({ error: 'Butcher ID is required' }, { status: 400 });
    }

    // Get orders from in-memory cache (Central API approach - no sheet polling)
    const cachedOrders = getAllOrdersFromCache(butcherId);
    
    // Return cached orders (sorted by time, newest first)
    // If cache is empty, return empty array (orders come from Central API push, not sheet polling)
    const sortedOrders = cachedOrders.sort(
      (a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime()
    );
      
    return NextResponse.json({ orders: sortedOrders });
    
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    
    // Return specific error for quota exceeded
    if (error.status === 429 || error.message?.includes('Quota exceeded')) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch orders', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/orders/[butcherId] - Create a new order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    const orderData: Order = await request.json();
    
    if (!butcherId || !orderData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    await saveOrderToSheet(orderData, butcherId);
    
    return NextResponse.json({ success: true, message: 'Order created successfully' });
    
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/orders/[butcherId] - Update an existing order
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    const orderData: Order = await request.json();
    
    if (!butcherId || !orderData || !orderData.id) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    await updateOrderInSheet(orderData, butcherId);
    
    return NextResponse.json({ success: true, message: 'Order updated successfully' });
    
  } catch (error: any) {
    console.error('Error updating order:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to update order', details: error.message },
      { status: 500 }
    );
  }
}
