"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order } from '../lib/types';
import { useClientCache } from './useClientCache';

interface UseOrderPollingOptions {
  butcherId: string;
  pollingInterval?: number; // in milliseconds, default 5 seconds
  enabled?: boolean;
}

interface UseOrderPollingReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useOrderPolling = ({
  butcherId,
  pollingInterval = 5000, // 5 seconds for real-time updates as requested by user
  enabled = true
}: UseOrderPollingOptions): UseOrderPollingReturn => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const quotaErrorCount = useRef(0);
  const circuitBreakerUntil = useRef<number>(0);
  const { get: getCached, set: setCached, clear: clearCache } = useClientCache();

  const fetchOrders = useCallback(async () => {
    if (!butcherId || isPollingRef.current) return;
    
    // Circuit breaker: if we've had too many quota errors, wait longer
    const now = Date.now();
    if (now < circuitBreakerUntil.current) {
      console.log('Circuit breaker active - waiting for quota reset');
      setError('Rate limit circuit breaker active. Waiting for quota reset...');
      return;
    }
    
    // Prevent rapid successive calls - minimum 4 second gap to respect quota limits
    const lastCallKey = `lastCall_${butcherId}`;
    const lastCall = getCached(lastCallKey);
    if (lastCall && (now - lastCall) < 4000) {
      console.log('Debouncing API call - too soon since last request');
      return;
    }
    setCached(lastCallKey, now, 10000);
    
    // Check cache first for instant updates
    const cacheKey = `orders_${butcherId}`;
    const cachedOrders = getCached<Order[]>(cacheKey);
    if (cachedOrders && !isLoading) {
      setOrders(cachedOrders);
    }
    
    isPollingRef.current = true;
    
    try {
      // Remove cache-busting to allow server-side caching
      const response = await fetch(`/api/orders/${butcherId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from orders API');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Parse dates back from JSON
      const ordersWithDates = data.orders.map((order: any) => ({
        ...order,
        orderTime: new Date(order.orderTime),
        preparationStartTime: order.preparationStartTime ? new Date(order.preparationStartTime) : undefined,
        preparationEndTime: order.preparationEndTime ? new Date(order.preparationEndTime) : undefined,
      }));

      setOrders(ordersWithDates);
      setError(null);
      
      // Reset quota error tracking on successful call
      quotaErrorCount.current = 0;
      circuitBreakerUntil.current = 0;
      setError(null);
      
      // Cache the fresh data for instant UI updates
      setCached(cacheKey, ordersWithDates, 1000); // 1 second cache for faster updates
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      
      // Handle quota exceeded errors specifically
      if (err.status === 429 || err.message?.includes('Quota exceeded')) {
        quotaErrorCount.current += 1;
        console.warn(`Google Sheets API quota exceeded (${quotaErrorCount.current} times), implementing circuit breaker...`);
        
        // Activate circuit breaker after 3 consecutive quota errors
        if (quotaErrorCount.current >= 3) {
          circuitBreakerUntil.current = Date.now() + 300000; // 5 minutes
          setError('Multiple quota exceeded errors. Circuit breaker active for 5 minutes.');
        } else {
          setError(`API rate limit reached. Backing off for ${quotaErrorCount.current * 2} minutes...`);
        }
        
        // Implement exponential backoff based on error count
        const backoffTime = Math.min(quotaErrorCount.current * 120000, 600000); // Max 10 minutes
        if (pollingRef.current) {
          clearTimeout(pollingRef.current);
          pollingRef.current = setTimeout(fetchOrders, backoffTime);
        }
      } else {
        // Reset quota error count on successful non-quota error
        quotaErrorCount.current = 0;
        circuitBreakerUntil.current = 0;
        setError(err.message || 'Failed to fetch orders');
      }
    } finally {
      setIsLoading(false);
      isPollingRef.current = false;
    }
  }, [butcherId]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchOrders();
  }, [fetchOrders]);

  // Start polling
  useEffect(() => {
    if (!enabled || !butcherId) return;

    // Initial fetch
    fetchOrders();

    // Set up polling
    pollingRef.current = setInterval(fetchOrders, pollingInterval);

    // Cleanup
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled, butcherId, pollingInterval, fetchOrders]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  return {
    orders,
    isLoading,
    error,
    refetch
  };
};

// Hook for updating orders
export const useOrderUpdate = () => {
  const updateOrder = useCallback(async (butcherId: string, order: Order) => {
    try {
      const response = await fetch(`/api/orders/${butcherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error: any) {
      console.error('Error updating order:', error);
      throw error;
    }
  }, []);

  const createOrder = useCallback(async (butcherId: string, order: Order) => {
    try {
      const response = await fetch(`/api/orders/${butcherId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw error;
    }
  }, []);

  return {
    updateOrder,
    createOrder
  };
};
