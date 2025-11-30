/**
 * Order Queue System
 * Queues orders and responses when Central API is unavailable
 */

import type { Order } from './types';

interface QueuedOrder {
  order: Order;
  receivedAt: Date;
  retryCount: number;
}

interface QueuedResponse {
  orderNo: number;
  butcher: string;
  items: Array<{
    itemId: string;
    preparingWeight?: string;
    rejected?: string;
    revenue?: number; // Revenue for accepted items in rupees
  }>;
  timestamp: Date;
  retryCount: number;
}

interface QueuedMenuUpdate {
  butcherId: string;
  butcherName: string;
  timestamp: Date;
  retryCount: number;
  lastRetryAt?: Date;
}

// In-memory queues (in production, use Redis or database)
const orderQueue: QueuedOrder[] = [];
const responseQueue: QueuedResponse[] = [];
const menuUpdateQueue: QueuedMenuUpdate[] = [];

export const MAX_RETRY_COUNT = 5;
const RETRY_DELAY = 60000; // 1 minute

/**
 * Queue an order when Central API is unavailable
 */
export function queueOrder(order: Order): void {
  const queuedOrder: QueuedOrder = {
    order,
    receivedAt: new Date(),
    retryCount: 0
  };
  
  orderQueue.push(queuedOrder);
}

/**
 * Queue a response when Central API is unavailable
 */
export function queueResponse(
  orderNo: number,
  butcher: string,
  items: Array<{
    itemId: string;
    preparingWeight?: string;
    rejected?: string;
    revenue?: number; // Revenue for accepted items in rupees
  }>
): void {
  const queuedResponse: QueuedResponse = {
    orderNo,
    butcher,
    items,
    timestamp: new Date(),
    retryCount: 0
  };
  
  responseQueue.push(queuedResponse);
}

/**
 * Get all queued orders
 */
export function getQueuedOrders(): QueuedOrder[] {
  return [...orderQueue];
}

/**
 * Get all queued responses
 */
export function getQueuedResponses(): QueuedResponse[] {
  return [...responseQueue];
}

/**
 * Remove a queued order (after successful processing)
 */
export function removeQueuedOrder(orderId: string): void {
  const index = orderQueue.findIndex(q => q.order.id === orderId);
  if (index !== -1) {
    orderQueue.splice(index, 1);
  }
}

/**
 * Remove a queued response (after successful submission)
 */
export function removeQueuedResponse(orderNo: number): void {
  const index = responseQueue.findIndex(q => q.orderNo === orderNo);
  if (index !== -1) {
    responseQueue.splice(index, 1);
  }
}

/**
 * Increment retry count for a queued order
 */
export function incrementOrderRetry(orderId: string): boolean {
  const queued = orderQueue.find(q => q.order.id === orderId);
  if (queued) {
    queued.retryCount++;
    return queued.retryCount < MAX_RETRY_COUNT;
  }
  return false;
}

/**
 * Increment retry count for a queued response
 */
export function incrementResponseRetry(orderNo: number): boolean {
  const queued = responseQueue.find(q => q.orderNo === orderNo);
  if (queued) {
    queued.retryCount++;
    return queued.retryCount < MAX_RETRY_COUNT;
  }
  return false;
}

/**
 * Queue a menu update notification when Central API is unavailable
 */
export function queueMenuUpdate(
  butcherId: string,
  butcherName: string
): void {
  const queuedUpdate: QueuedMenuUpdate = {
    butcherId,
    butcherName,
    timestamp: new Date(),
    retryCount: 0
  };
  
  menuUpdateQueue.push(queuedUpdate);
}

/**
 * Get all queued menu updates
 */
export function getQueuedMenuUpdates(): QueuedMenuUpdate[] {
  return [...menuUpdateQueue];
}

/**
 * Remove a queued menu update (after successful notification)
 */
export function removeQueuedMenuUpdate(butcherId: string, butcherName: string): void {
  const index = menuUpdateQueue.findIndex(
    q => q.butcherId === butcherId && q.butcherName === butcherName
  );
  if (index !== -1) {
    menuUpdateQueue.splice(index, 1);
  }
}

/**
 * Increment retry count for a queued menu update
 */
export function incrementMenuUpdateRetry(butcherId: string, butcherName: string): boolean {
  const queued = menuUpdateQueue.find(
    q => q.butcherId === butcherId && q.butcherName === butcherName
  );
  if (queued) {
    queued.retryCount++;
    queued.lastRetryAt = new Date();
    return queued.retryCount < MAX_RETRY_COUNT;
  }
  return false;
}

/**
 * Get retry delay for menu update (exponential backoff)
 * Returns delay in milliseconds: 1min, 2min, 4min, 8min, 16min (max)
 */
export function getMenuUpdateRetryDelay(retryCount: number): number {
  const baseDelay = 60000; // 1 minute
  const maxDelay = 960000; // 16 minutes
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  return delay;
}

/**
 * Check if menu update is ready for retry
 */
export function isMenuUpdateReadyForRetry(queued: QueuedMenuUpdate): boolean {
  if (queued.retryCount === 0) {
    return true; // First retry immediately
  }
  
  if (!queued.lastRetryAt) {
    return true; // No previous retry, ready now
  }
  
  const delay = getMenuUpdateRetryDelay(queued.retryCount - 1);
  const timeSinceLastRetry = Date.now() - queued.lastRetryAt.getTime();
  return timeSinceLastRetry >= delay;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): { orders: number; responses: number; menuUpdates: number } {
  return {
    orders: orderQueue.length,
    responses: responseQueue.length,
    menuUpdates: menuUpdateQueue.length
  };
}

/**
 * Clear all queues (for testing/debugging)
 */
export function clearQueues(): void {
  orderQueue.length = 0;
  responseQueue.length = 0;
  menuUpdateQueue.length = 0;
}

// Export types for use in other modules
export type { QueuedOrder, QueuedResponse, QueuedMenuUpdate };

