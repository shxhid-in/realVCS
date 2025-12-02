import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken, extractTokenFromHeader } from '@/lib/auth/jwt';
import { getButcherNameFromId } from '@/lib/butcherMapping';
import { getOrderFromCache, updateOrderInCache, removeOrderFromCache } from '@/lib/orderCache';
import { centralAPIClient } from '@/lib/centralAPIClient';
import { queueResponse, removeQueuedResponse } from '@/lib/orderQueue';
import { saveOrderToSheetAfterAccept, getPurchasePriceFromMenu } from '@/lib/sheets';
import { getCommissionRate } from '@/lib/rates';
import type { Order, OrderItem } from '@/lib/types';

/**
 * POST /api/orders/respond
 * Submit order response (accept/reject items) to Central API
 * 
 * Headers: Authorization: Bearer <user-jwt-token>
 * Body: {
 *   orderNo: number,
 *   items: Array<{
 *     itemId: string,
 *     preparingWeight?: string, // "1.5kg" or "500g"
 *     rejected?: string // Rejection reason
 *   }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user JWT token
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing authorization token' },
        { status: 401 }
      );
    }

    const user = verifyUserToken(token);
    if (!user || !user.butcherId) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderNo, items } = body;

    if (!orderNo || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request', message: 'orderNo and items array are required' },
        { status: 400 }
      );
    }

    // Get order from cache
    const order = getOrderFromCache(user.butcherId, orderNo);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found', message: `Order ${orderNo} not found in cache` },
        { status: 404 }
      );
    }

    // Get Central API butcher name
    const butcherName = getButcherNameFromId(user.butcherId);
    if (!butcherName) {
      return NextResponse.json(
        { error: 'Invalid butcher', message: `Butcher ${user.butcherId} not found` },
        { status: 400 }
      );
    }

    // Update order items with preparing weights and rejection reasons
    const updatedItems: OrderItem[] = order.items.map(orderItem => {
      const responseItem = items.find((r: any) => r.itemId === orderItem.id);
      if (!responseItem) {
        return orderItem; // Item not processed, keep original
      }

      // Create updated item with preparing weight or rejection
      const updatedItem: OrderItem = { ...orderItem };
      
      if (responseItem.preparingWeight) {
        // Item accepted - store preparing weight
        (updatedItem as any).preparingWeight = responseItem.preparingWeight;
        (updatedItem as any).rejected = undefined;
      } else if (responseItem.rejected) {
        // Item rejected - store rejection reason
        (updatedItem as any).rejected = responseItem.rejected;
        (updatedItem as any).preparingWeight = undefined;
      }

      return updatedItem;
    });

    // Check if all items are rejected
    const allItemsRejected = updatedItems.every(item => (item as any).rejected);
    const rejectionReason = allItemsRejected && updatedItems.length > 0 
      ? (updatedItems[0] as any).rejected 
      : undefined;

    // Determine order status
    let orderStatus: 'preparing' | 'rejected' = 'preparing';
    if (allItemsRejected) {
      orderStatus = 'rejected';
    }

    // Update order in cache
    const updatedOrder: Order = {
      ...order,
      items: updatedItems,
      status: orderStatus,
      ...(allItemsRejected && rejectionReason ? { rejectionReason } : {}),
      ...(orderStatus === 'preparing' ? { preparationStartTime: new Date() } : {})
    };

    updateOrderInCache(user.butcherId, orderNo, updatedOrder);

    // Helper function to parse weight string (e.g., "1.5kg" -> 1.5, "500g" -> 0.5)
    const parseWeightString = (weightStr: string, unit: string): number => {
      if (!weightStr) return 0;
      
      // Remove unit if present and extract numeric part
      const numericPart = weightStr.replace(/[^0-9.]/g, '');
      const weight = parseFloat(numericPart) || 0;
      
      // Convert grams to kg if needed
      if (weightStr.toLowerCase().includes('g') && !weightStr.toLowerCase().includes('kg')) {
        return weight / 1000; // Convert grams to kg
      }
      
      return weight;
    };

    // Prepare response items for Central API (revenue will be added after sheet save)
    const centralAPIItems = items.map((item: any) => {
      return {
        itemId: item.itemId,
        ...(item.preparingWeight && { preparingWeight: item.preparingWeight }),
        ...(item.rejected && { rejected: item.rejected })
      };
    });

    // Step 1: Calculate revenue and save to sheet immediately (before Central API call)
    // For completely rejected orders, revenue will be 0
    const { totalRevenue, itemRevenues } = await saveOrderToSheetAfterAccept(updatedOrder, user.butcherId);
    
    // Update order in cache with calculated revenue
    const orderWithRevenue: Order = {
      ...updatedOrder,
      revenue: totalRevenue,
      itemRevenues: itemRevenues
    };
    updateOrderInCache(user.butcherId, orderNo, orderWithRevenue);
    
    // Step 2: Add item revenue to Central API response items
    const centralAPIItemsWithRevenue = centralAPIItems.map((item: any) => {
      // Find corresponding order item to get name
      const orderItem = updatedItems.find(oi => oi.id === item.itemId);
      if (orderItem && itemRevenues) {
        // Find revenue for this item (itemKey format: itemName_size)
        const itemSize = orderItem.size || 'default';
        const itemKey = `${orderItem.name}_${itemSize}`;
        const itemRevenue = itemRevenues[itemKey];
        if (itemRevenue !== undefined && itemRevenue > 0) {
          item.revenue = parseFloat(itemRevenue.toFixed(2));
        }
      }
      return item;
    });
    
    // Step 3: Send response to Central API (after saving to sheet)
    try {
      await centralAPIClient.sendOrderResponse(orderNo, butcherName, centralAPIItemsWithRevenue);
      console.log(`[Order] Status updated: ${orderStatus} - Order ${orderNo}`);
      
      // Remove from queue if it was queued
      removeQueuedResponse(orderNo);
      
      // Send SSE update with full order data (includes preparing weights, revenue, etc.)
      const { sendOrderStatusUpdate } = await import('@/lib/sseConnectionManager');
      sendOrderStatusUpdate(user.butcherId, orderWithRevenue);
      
      return NextResponse.json({
        success: true,
        message: 'Order response submitted successfully',
        order: orderWithRevenue
      });
    } catch (error: any) {
      // Queue the response for retry (sheet already saved)
      queueResponse(orderNo, butcherName, centralAPIItemsWithRevenue);
      
      // Send SSE update with full order data even if queued
      const { sendOrderStatusUpdate } = await import('@/lib/sseConnectionManager');
      sendOrderStatusUpdate(user.butcherId, orderWithRevenue);
      
      return NextResponse.json(
        {
          success: true,
          message: 'Order response queued (Central API unavailable)',
          order: orderWithRevenue,
          warning: 'Response will be sent when Central API is available'
        },
        { status: 202 } // Accepted but queued
      );
    }
  } catch (error: any) {
    console.error('[Order Response] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Failed to submit order response'
      },
      { status: 500 }
    );
  }
}

