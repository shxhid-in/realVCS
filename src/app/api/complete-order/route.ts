import { NextRequest, NextResponse } from 'next/server';
import { completeOrder } from '@/lib/sheets';
import { sendOrderStatusUpdate } from '@/lib/sseConnectionManager';
import { updateOrderInCache } from '@/lib/orderCache';
import type { Order } from '@/lib/types';

export async function POST(request: NextRequest) {
  let order: Order | undefined;
  let butcherId: string | undefined;
  
  try {
    const body = await request.json();
    order = body.order;
    butcherId = body.butcherId;

    if (!order || !butcherId) {
      return NextResponse.json(
        { error: 'Missing required fields: order, butcherId' },
        { status: 400 }
      );
    }

    await completeOrder(order, butcherId);
    
    // Extract order number from order ID (ORD-123 -> 123 or ORD-2025-01-15-123 -> 123)
    const orderIdParts = order.id.replace('ORD-', '').split('-');
    const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10);
    
    if (!isNaN(orderNo)) {
      // Get the full order from cache FIRST to preserve revenue and other fields
      const { getOrderFromCache } = await import('@/lib/orderCache');
      const cachedOrder = getOrderFromCache(butcherId, orderNo);
      
      // Merge incoming order updates with cached order (preserves revenue, itemRevenues, etc.)
      const completedOrder: Order = {
        ...(cachedOrder || order), // Use cached order as base (has revenue), fallback to incoming order
        ...order, // Apply any updates from incoming order
        status: 'completed',
        preparationEndTime: new Date(),
        completionTime: Date.now()
      };
      
      updateOrderInCache(butcherId, orderNo, completedOrder);
      console.log(`[Order] Status updated: completed - Order ${orderNo}`);
      
      // Send SSE update with full order data (includes revenue, preparing weights, etc.)
      sendOrderStatusUpdate(butcherId, completedOrder);
    }
    
    // Return updated order object for UI update
    const updatedOrder: Order = {
      ...order,
      status: 'completed',
      completionTime: Date.now()
    };
    
    return NextResponse.json({ 
      success: true, 
      message: 'Order completed successfully',
      order: updatedOrder,
      orderId: order.id 
    });
  } catch (error) {
    console.error('[Order] Error completing order:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        error: 'Failed to complete order', 
        message: errorMessage,
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
