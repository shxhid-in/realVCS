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
 * Orders are pushed from Central API in real-time with polling fallback
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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageTimeRef = useRef<number>(Date.now());
  const reconnectAttemptRef = useRef<number>(0);
  const isPollingActiveRef = useRef<boolean>(false);

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

  // Fetch orders from cache (used on initial load, reconnect, and polling)
  const fetchOrders = useCallback(async (source: 'initial' | 'reconnect' | 'polling' = 'initial') => {
    if (!butcherId || !enabled) {
      return;
    }

    try {
      console.log(`[OrderCache] Fetching orders via ${source} for butcher: ${butcherId}`);
      
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

      // Merge with existing orders (deduplicate)
      setOrders(prevOrders => {
        const existingIds = new Set(prevOrders.map(o => o.id));
        const newOrders = ordersWithDates.filter((o: Order) => !existingIds.has(o.id));
        
        if (newOrders.length > 0) {
          console.log(`[OrderCache] Found ${newOrders.length} new orders via ${source}`);
        }
        
        // Merge and sort by order number
        const merged = [...prevOrders, ...newOrders];
        return merged.sort((a, b) => {
          const aNo = parseInt(a.id.replace('ORD-', '').split('-').pop() || '0', 10);
          const bNo = parseInt(b.id.replace('ORD-', '').split('-').pop() || '0', 10);
          return bNo - aNo; // Newest first
        });
      });
      
      setError(null);
    } catch (err: any) {
      console.error(`[OrderCache] Error fetching orders via ${source}:`, err);
      setError(err.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  }, [butcherId, enabled]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchOrders('initial');
  }, [fetchOrders]);

  // Start polling fallback when SSE is dead
  const startPolling = useCallback(() => {
    if (isPollingActiveRef.current) {
      return; // Already polling
    }

    console.log(`[OrderCache] Starting fallback polling for butcher: ${butcherId}`);
    isPollingActiveRef.current = true;

    // Poll every 12 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchOrders('polling');
    }, 12000);

    // Initial poll immediately
    fetchOrders('polling');
  }, [butcherId, fetchOrders]);

  // Stop polling fallback
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log(`[OrderCache] Stopping fallback polling for butcher: ${butcherId}`);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      isPollingActiveRef.current = false;
    }
  }, [butcherId]);

  // Check if SSE connection is dead (no messages in 60 seconds)
  const checkConnectionHealth = useCallback(() => {
    const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current;
    const isDead = timeSinceLastMessage > 60000; // 60 seconds

    if (isDead && eventSourceRef.current && !isPollingActiveRef.current) {
      console.warn(`[OrderCache] SSE connection appears dead (no messages for ${Math.round(timeSinceLastMessage / 1000)}s). Starting polling fallback.`);
      startPolling();
    } else if (!isDead && isPollingActiveRef.current && eventSourceRef.current?.readyState === EventSource.OPEN) {
      console.log(`[OrderCache] SSE connection healthy. Stopping polling fallback.`);
      stopPolling();
    }
  }, [startPolling, stopPolling]);

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

    // Always fetch on mount/reconnect (even if SSE is connecting)
    fetchOrders('initial');

    // Get JWT token for authentication
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    // Create SSE connection with exponential backoff
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
      
      const connectionStartTime = Date.now();
      lastMessageTimeRef.current = Date.now();

      // Handle connection open
      eventSource.onopen = () => {
        console.log(`[OrderCache] SSE connected for butcher: ${butcherId}`);
        setError(null);
        lastMessageTimeRef.current = Date.now();
        reconnectAttemptRef.current = 0; // Reset on successful connection
        stopPolling(); // Stop polling if SSE is working
      };

      // Handle messages
      eventSource.onmessage = (event) => {
        try {
          // Update last message time
          lastMessageTimeRef.current = Date.now();
          
          // Handle keep-alive pings (no data)
          if (event.data === ': keep-alive' || event.data.trim() === '') {
            return;
          }

          const data = JSON.parse(event.data);

          if (data.type === 'initial-orders') {
            console.log(`[OrderCache] Received initial orders via SSE: ${data.orders?.length || 0} orders`);
            const ordersWithDates = (data.orders || []).map((order: any) => ({
              ...order,
              orderTime: new Date(order.orderTime),
              preparationStartTime: order.preparationStartTime ? new Date(order.preparationStartTime) : undefined,
              preparationEndTime: order.preparationEndTime ? new Date(order.preparationEndTime) : undefined,
            }));
            setOrders(ordersWithDates);
          } else if (data.type === 'new-order') {
            console.log(`[OrderCache] Received new order via SSE: ${data.order?.id}`);
            const orderWithDates = {
              ...data.order,
              orderTime: new Date(data.order.orderTime),
              preparationStartTime: data.order.preparationStartTime ? new Date(data.order.preparationStartTime) : undefined,
              preparationEndTime: data.order.preparationEndTime ? new Date(data.order.preparationEndTime) : undefined,
            };
            pendingOrdersRef.current.push(orderWithDates);
            setPendingCount(prev => prev + 1);
          } else if (data.type === 'order-status-update') {
            console.log(`[OrderCache] Received order status update via SSE: ${data.order?.id}`);
            const updatedOrder = {
              ...data.order,
              orderTime: data.order.orderTime ? new Date(data.order.orderTime) : new Date(),
              preparationStartTime: data.order.preparationStartTime ? new Date(data.order.preparationStartTime) : undefined,
              preparationEndTime: data.order.preparationEndTime ? new Date(data.order.preparationEndTime) : undefined,
            };
            setOrders(prev => prev.map(order => 
              order.id === updatedOrder.id 
                ? updatedOrder
                : order
            ));
          } else if (data.type === 'connected') {
            console.log(`[OrderCache] SSE connection confirmed for butcher: ${data.butcherId}`);
          }
        } catch (err: any) {
          console.error(`[OrderCache] Error parsing SSE message:`, err);
        }
      };

      // Handle errors
      eventSource.onerror = (error) => {
        const timeSinceStart = Date.now() - connectionStartTime;
        const failedImmediately = timeSinceStart < 2000; // Failed within 2 seconds = likely 403
        
        if (eventSource.readyState === EventSource.CLOSED) {
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
          
          if (failedImmediately) {
            console.error(`[OrderCache] SSE connection failed immediately (likely 403). Starting polling fallback.`);
            setError('Access denied: You do not have permission to access this butcher\'s orders');
            setIsLoading(false);
            startPolling(); // Start polling as fallback
            return;
          }
          
          if (eventSourceRef.current === null && enabled && butcherId) {
            console.warn(`[OrderCache] SSE connection closed. Reconnecting with exponential backoff...`);
            
            // Exponential backoff: 2s, 4s, 8s, 16s, 32s (max)
            const backoffDelay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 32000);
            reconnectAttemptRef.current++;
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, backoffDelay);
            
            // Start polling while reconnecting
            if (!isPollingActiveRef.current) {
              startPolling();
            }
          }
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          if (eventSourceRef.current === eventSource) {
            eventSourceRef.current = null;
          }
          
          if (failedImmediately) {
            console.error(`[OrderCache] SSE connection failed immediately (likely 403). Starting polling fallback.`);
            setError('Access denied: You do not have permission to access this butcher\'s orders');
            setIsLoading(false);
            startPolling();
            return;
          }
          
          if (enabled && butcherId) {
            console.warn(`[OrderCache] SSE connection error. Retrying with exponential backoff...`);
            
            const backoffDelay = Math.min(2000 * Math.pow(2, reconnectAttemptRef.current), 32000);
            reconnectAttemptRef.current++;
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connectSSE();
            }, backoffDelay);
            
            // Start polling while reconnecting
            if (!isPollingActiveRef.current) {
              startPolling();
            }
          }
        }
        
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
        }
      };
    };

    // Connect SSE
    connectSSE();

    // Health check interval: Check connection health every 15 seconds
    const healthCheckInterval = setInterval(() => {
      checkConnectionHealth();
    }, 15000);

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
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      clearInterval(healthCheckInterval);
      stopPolling();
    };
  }, [enabled, butcherId, fetchOrders, user, checkConnectionHealth, startPolling, stopPolling]);

  return {
    orders,
    isLoading,
    error,
    refetch
  };
};

