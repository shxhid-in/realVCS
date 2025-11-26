"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Order } from '../lib/types';
import { useAuth } from '../context/AuthContext';

interface UseOrderCacheOptions {
  butcherId: string;
  enabled?: boolean;
}

interface UseOrderCacheReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch orders from cache using SSE (Server-Sent Events)
 * Orders are pushed from Central API in real-time - no polling needed
 */
export const useOrderCache = ({
  butcherId,
  enabled = true
}: UseOrderCacheOptions): UseOrderCacheReturn => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOrdersRef = useRef<Order[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Batch update orders (debounced)
  const batchUpdateOrders = useCallback((newOrders: Order[]) => {
    setOrders(prevOrders => {
      // Deduplicate: check if order already exists
      const existingIds = new Set(prevOrders.map(o => o.id));
      const uniqueNewOrders = newOrders.filter(o => !existingIds.has(o.id));
      
      if (uniqueNewOrders.length === 0) {
        return prevOrders; // No new orders
      }
      
      // Merge and sort by order number
      const merged = [...prevOrders, ...uniqueNewOrders];
      return merged.sort((a, b) => {
        const aNo = parseInt(a.id.replace('ORD-', '').split('-').pop() || '0', 10);
        const bNo = parseInt(b.id.replace('ORD-', '').split('-').pop() || '0', 10);
        return bNo - aNo; // Newest first
      });
    });
  }, []);

  // Track pending orders count for effect dependency
  const [pendingCount, setPendingCount] = useState(0);

  // Debounced batch update
  useEffect(() => {
    if (pendingOrdersRef.current.length === 0) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const pending = pendingOrdersRef.current;
      if (pending.length > 0) {
        batchUpdateOrders(pending);
        pendingOrdersRef.current = [];
        setPendingCount(0);
      }
    }, 100); // 100ms debounce

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pendingCount, batchUpdateOrders]);

  // Fetch orders from cache (used on initial load and reconnect)
  const fetchOrders = useCallback(async () => {
    if (!butcherId || !enabled) {
      return;
    }

    try {
      const response = await fetch(`/api/orders-cache/${butcherId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Parse dates back from JSON
      const ordersWithDates = (data.orders || []).map((order: any) => ({
        ...order,
        orderTime: new Date(order.orderTime),
        preparationStartTime: order.preparationStartTime ? new Date(order.preparationStartTime) : undefined,
        preparationEndTime: order.preparationEndTime ? new Date(order.preparationEndTime) : undefined,
      }));

      setOrders(ordersWithDates);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [butcherId, enabled]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchOrders();
  }, [fetchOrders]);

  // ✅ FIX: Get auth context to check if auth is ready
  const { user } = useAuth();

  // SSE connection setup
  useEffect(() => {
    if (!enabled || !butcherId) {
      setIsLoading(false);
      return;
    }

    // ✅ FIX: Wait for auth to be ready (user must be set)
    // Don't proceed if user is not authenticated yet
    if (!user) {
      // Auth is still loading, don't set error yet - just wait
      return;
    }

    // ✅ FIX: Check authorization before attempting connection
    // Admin users can access any butcher, regular users can only access their own
    const isAdmin = (user as any).role === 'admin';
    const userButcherId = (user as any).id || (user as any).butcherId;
    
    if (!isAdmin && userButcherId !== butcherId) {
      setError('Access denied: You can only access your own orders');
      setIsLoading(false);
      return; // Don't attempt connection
    }

    // Initial fetch
    fetchOrders();

    // Get JWT token for authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    // Create SSE connection
    const connectSSE = () => {
      // Close existing connection if any and clear ref
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // EventSource doesn't support custom headers, so pass token in URL
      // This is acceptable since token is in localStorage (client-side) and validated server-side
      const url = `/api/orders/stream?butcherId=${butcherId}&token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;
      
      // ✅ FIX: Track connection start time to detect immediate failures (likely 403)
      const connectionStartTime = Date.now();

      // Handle connection open
      eventSource.onopen = () => {
        setError(null);
      };

      // Handle messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'initial-orders') {
            // Initial orders sent on connection
            const ordersWithDates = (data.orders || []).map((order: any) => ({
              ...order,
              orderTime: new Date(order.orderTime),
              preparationStartTime: order.preparationStartTime ? new Date(order.preparationStartTime) : undefined,
              preparationEndTime: order.preparationEndTime ? new Date(order.preparationEndTime) : undefined,
            }));
            setOrders(ordersWithDates);
          } else if (data.type === 'new-order') {
            // New order arrived - add to pending (will be batched)
            const orderWithDates = {
              ...data.order,
              orderTime: new Date(data.order.orderTime),
              preparationStartTime: data.order.preparationStartTime ? new Date(data.order.preparationStartTime) : undefined,
              preparationEndTime: data.order.preparationEndTime ? new Date(data.order.preparationEndTime) : undefined,
            };
            pendingOrdersRef.current.push(orderWithDates);
            // Trigger debounced update by incrementing count
            setPendingCount(prev => prev + 1);
          } else if (data.type === 'order-status-update') {
            // ✅ FIX: Order status changed - merge full order data (preserves optimistic updates)
            const updatedOrder = {
              ...data.order,
              orderTime: data.order.orderTime ? new Date(data.order.orderTime) : new Date(),
              preparationStartTime: data.order.preparationStartTime ? new Date(data.order.preparationStartTime) : undefined,
              preparationEndTime: data.order.preparationEndTime ? new Date(data.order.preparationEndTime) : undefined,
            };
            setOrders(prev => prev.map(order => 
              order.id === updatedOrder.id 
                ? updatedOrder  // ✅ FIX: Replace with full order data from server
                : order
            ));
          }
        } catch (err: any) {
          // Silently handle parsing errors
        }
      };

      // Handle errors
      eventSource.onerror = (error) => {
        // EventSource error event doesn't contain detailed error info
        // Check readyState to determine error type
        const timeSinceStart = Date.now() - connectionStartTime;
        const failedImmediately = timeSinceStart < 2000; // Failed within 2 seconds = likely 403
        
        if (eventSource.readyState === EventSource.CLOSED) {
          // Clear ref when connection is closed
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
          
          // If connection closed immediately, it's likely a 403 - don't retry
          if (failedImmediately) {
            setError('Access denied: You do not have permission to access this butcher\'s orders');
            setIsLoading(false);
            return; // Don't retry for forbidden access
          }
          
          // Don't reconnect if we intentionally closed it or if component unmounted
          if (eventSourceRef.current === null && enabled && butcherId) {
            setError('Connection closed. Reconnecting...');
            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, 5000);
          }
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          // Clear ref on connection error
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
          
          // If connection fails immediately, it might be a 403 - don't retry
          if (failedImmediately) {
            setError('Access denied: You do not have permission to access this butcher\'s orders');
            setIsLoading(false);
            return; // Don't retry
          }
          
          // Only reconnect if still enabled and not forbidden
          if (enabled && butcherId && eventSourceRef.current !== null) {
            setError('Failed to connect. Retrying...');
            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, 5000);
          }
        }
        
        // Only close if not already closed
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };
    };

    // Connect
    connectSSE();

    // Cleanup - ensure connection is properly closed
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [enabled, butcherId, fetchOrders, user]); // ✅ FIX: Add user dependency to wait for auth

  return {
    orders,
    isLoading,
    error,
    refetch
  };
};

