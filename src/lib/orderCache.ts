/**
 * In-Memory Order Cache System
 * Stores orders per butcher, only writes to sheets on completion
 */

import type { Order } from './types';

// Cache structure: butcherId → orderNo (number) → Order
const orderCache = new Map<string, Map<number, Order>>();

/**
 * Cache an order for a specific butcher
 */
export function cacheOrder(butcherId: string, order: Order): void {
  if (!orderCache.has(butcherId)) {
    orderCache.set(butcherId, new Map());
  }
  
  const butcherCache = orderCache.get(butcherId)!;
  
  // Extract order number from order ID (ORD-123 -> 123)
  const orderNo = extractOrderNumber(order.id);
  
  if (orderNo) {
    butcherCache.set(orderNo, order);
  }
}

/**
 * Get a specific order from cache by order number
 */
export function getOrderFromCache(butcherId: string, orderNo: number): Order | null {
  const butcherCache = orderCache.get(butcherId);
  if (!butcherCache) {
    return null;
  }
  
  return butcherCache.get(orderNo) || null;
}

/**
 * Get all orders from cache for a specific butcher
 */
export function getAllOrdersFromCache(butcherId: string): Order[] {
  const butcherCache = orderCache.get(butcherId);
  if (!butcherCache) {
    return [];
  }
  
  return Array.from(butcherCache.values());
}

/**
 * Update an order in cache
 */
export function updateOrderInCache(butcherId: string, orderNo: number, updates: Partial<Order>): void {
  const butcherCache = orderCache.get(butcherId);
  if (!butcherCache) {
    return;
  }
  
  const existingOrder = butcherCache.get(orderNo);
  if (existingOrder) {
    const updatedOrder: Order = {
      ...existingOrder,
      ...updates
    };
    butcherCache.set(orderNo, updatedOrder);
  }
}

/**
 * Remove an order from cache (after completion/storage)
 */
export function removeOrderFromCache(butcherId: string, orderNo: number): void {
  const butcherCache = orderCache.get(butcherId);
  if (butcherCache) {
    butcherCache.delete(orderNo);
  }
}

/**
 * Clear all orders for a specific butcher
 */
export function clearButcherCache(butcherId: string): void {
  orderCache.delete(butcherId);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { butcherId: string; orderCount: number }[] {
  return Array.from(orderCache.entries()).map(([butcherId, cache]) => ({
    butcherId,
    orderCount: cache.size
  }));
}

/**
 * Extract order number from order ID
 * ORD-123 -> 123
 * ORD-2025-01-15-123 -> 123
 */
function extractOrderNumber(orderId: string): number | null {
  const parts = orderId.replace('ORD-', '').split('-');
  const lastPart = parts[parts.length - 1];
  const orderNo = parseInt(lastPart, 10);
  return isNaN(orderNo) ? null : orderNo;
}

