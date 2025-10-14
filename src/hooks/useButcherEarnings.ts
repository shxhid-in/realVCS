"use client";

import { useState, useEffect, useCallback } from 'react';
import { getButcherEarnings } from '../lib/sheets';
import type { OrderItem } from '../lib/types';

interface ButcherEarnings {
  [itemName: string]: {
    purchasePrice: number;
    butcherEarnings: number;
    totalEarnings: number;
  };
}

interface UseButcherEarningsOptions {
  butcherId: string;
  orderItems: OrderItem[];
  enabled?: boolean;
}

interface UseButcherEarningsReturn {
  earnings: ButcherEarnings | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useButcherEarnings = ({
  butcherId,
  orderItems,
  enabled = true
}: UseButcherEarningsOptions): UseButcherEarningsReturn => {
  const [earnings, setEarnings] = useState<ButcherEarnings | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start as false to prevent unnecessary loading
  const [error, setError] = useState<string | null>(null);
  
  // Cache key for this specific request
  const cacheKey = `${butcherId}-${orderItems.map(i => i.name).join(',')}`;

  const fetchEarnings = useCallback(async () => {
    if (!enabled || !butcherId || orderItems.length === 0) {
      setEarnings(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getButcherEarnings(butcherId, orderItems);
      setEarnings(result);
    } catch (err: any) {
      console.error('Error fetching butcher earnings:', err);
      
      // Handle quota exceeded errors specifically
      if (err.status === 429 || err.message?.includes('Quota exceeded')) {
        setError('Rate limit reached. Using default pricing.');
      } else {
        setError(err.message || 'Failed to fetch earnings');
      }
      
      // Set default earnings on error (only if we don't have cached data)
      if (!earnings) {
        const defaultEarnings: ButcherEarnings = {};
        orderItems.forEach(item => {
          const defaultPrice = 450;
          const butcherPrice = defaultPrice - (defaultPrice * 0.07);
          defaultEarnings[item.name] = {
            purchasePrice: defaultPrice,
            butcherEarnings: butcherPrice,
            totalEarnings: butcherPrice * item.quantity
          };
        });
        setEarnings(defaultEarnings);
      }
    } finally {
      setIsLoading(false);
    }
  }, [butcherId, cacheKey, enabled]);

  const refetch = useCallback(async () => {
    await fetchEarnings();
  }, [fetchEarnings]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return {
    earnings,
    isLoading,
    error,
    refetch
  };
};
