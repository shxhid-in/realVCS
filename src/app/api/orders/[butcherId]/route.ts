import { NextRequest, NextResponse } from 'next/server';
import { getOrdersFromSheet, saveOrderToSheet, updateOrderInSheet } from '../../../../lib/sheets';
import type { Order } from '../../../../lib/types';

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

const getCached = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCached = (key: string, data: any, ttl: number = 10000) => {
  cache.set(key, { data, timestamp: Date.now(), ttl });
};

// GET /api/orders/[butcherId] - Get all orders for a butcher
// In-memory request deduplication
const activeRequests = new Map<string, Promise<any>>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    const { butcherId } = await params;
    
    if (!butcherId) {
      return NextResponse.json({ error: 'Butcher ID is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `orders_${butcherId}`;
    const cachedOrders = getCached(cacheKey);
    if (cachedOrders) {
      return NextResponse.json({ orders: cachedOrders });
    }

    // Request deduplication - if same request is already in progress, wait for it
    if (activeRequests.has(butcherId)) {
      const orders = await activeRequests.get(butcherId);
      return NextResponse.json({ orders });
    }

    // Create and track the request promise
    const requestPromise = getOrdersFromSheet(butcherId);
    activeRequests.set(butcherId, requestPromise);
    
    try {
      const orders = await requestPromise;
      
      // Cache for 30 seconds to reduce API calls during high usage
      setCached(cacheKey, orders, 30000);
      
      return NextResponse.json({ orders });
    } finally {
      // Always clean up the active request
      activeRequests.delete(butcherId);
    }
    
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
    
    // Invalidate cache when new order is created
    const cacheKey = `orders_${butcherId}`;
    cache.delete(cacheKey);
    
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
    
    // Invalidate cache when order is updated
    const cacheKey = `orders_${butcherId}`;
    cache.delete(cacheKey);
    
    return NextResponse.json({ success: true, message: 'Order updated successfully' });
    
  } catch (error: any) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order', details: error.message },
      { status: 500 }
    );
  }
}
