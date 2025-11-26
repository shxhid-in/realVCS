import { NextRequest, NextResponse } from 'next/server';
import { verifyAPISecret, extractTokenFromHeader } from '@/lib/auth/jwt';
import { getButcherIdFromName } from '@/lib/butcherMapping';
import { cacheOrder } from '@/lib/orderCache';
import { queueOrder as queueOrderToQueue } from '@/lib/orderQueue';
import { sendOrderUpdate } from '@/lib/sseConnectionManager';
import type { Order, OrderItem } from '@/lib/types';

/**
 * POST /vcs/orders/new
 * Receives orders from Central API Middleware
 * 
 * Headers: Authorization: Bearer API_SECRET
 * Body: {
 *   orderNo: number,
 *   butcher: string, // "Usaj Meat Hub"
 *   items: Array<{
 *     itemId: string,
 *     name: string,
 *     size: string,
 *     quantityParsed: { value: number, unit: string },
 *     cutType: string
 *   }>,
 *   timestamp: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API secret
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token || !verifyAPISecret(token)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid API secret' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderNo, butcher, items, timestamp } = body;

    // Validate required fields
    if (!orderNo || !butcher || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid order data',
          message: 'orderNo, butcher, and items array are required'
        },
        { status: 400 }
      );
    }

    // Map butcher name to butcher ID
    const butcherId = getButcherIdFromName(butcher);
    if (!butcherId) {
      return NextResponse.json(
        {
          error: 'Invalid butcher name',
          message: `Butcher "${butcher}" not found`
        },
        { status: 400 }
      );
    }

    // Convert Central API format to VCS Order format
    const orderId = `ORD-${orderNo}`; // Convert 123 -> "ORD-123"
    const orderDate = timestamp ? new Date(timestamp) : new Date();

    // Convert items
    const orderItems: OrderItem[] = items.map((item: any) => ({
      id: item.itemId, // "57788-1"
      name: item.name,
      quantity: item.quantityParsed.value,
      unit: item.quantityParsed.unit as 'kg' | 'g' | 'nos',
      size: item.size || undefined,
      cutType: item.cutType || undefined
    }));

    // Create Order object
    const order: Order = {
      id: orderId,
      customerName: 'Unknown', // Not provided by Central API
      items: orderItems,
      status: 'new',
      orderTime: orderDate,
      butcherId,
      butcherName: butcher,
      // Store source information
      _source: 'central-api' as any,
      _receivedAt: new Date() as any
    };

    // Cache the order
    try {
      cacheOrder(butcherId, order);
      console.log(`[Order] New order arrived: Order ${orderNo} for ${butcher}`);
      
      // Send SSE message to all connected clients for this butcher
      try {
        sendOrderUpdate(butcherId, order);
      } catch (sseError: any) {
        // SSE failure shouldn't break the order processing
      }
      
      return NextResponse.json({
        success: true,
        message: `Order ${orderNo} received for ${butcher}`,
        orderId: orderId
      });
    } catch (error: any) {
      console.error(`[Order] Error caching order:`, error);
      
      // Queue the order if caching fails
      queueOrderToQueue(order);
      
      return NextResponse.json(
        {
          success: true,
          message: `Order ${orderNo} queued for ${butcher}`,
          orderId: orderId,
          warning: 'Order cached in queue due to error'
        },
        { status: 202 } // Accepted but queued
      );
    }
  } catch (error: any) {
    console.error('[Order] Error receiving order:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to process order',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

