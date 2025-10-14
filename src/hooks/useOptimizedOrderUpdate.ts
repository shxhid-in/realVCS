"use client";

import { useState, useCallback } from 'react';
import type { Order } from '../lib/types';

interface UseOptimizedOrderUpdateReturn {
  updateOrder: (butcherId: string, order: Order) => Promise<any>;
  isUpdating: boolean;
}

export const useOptimizedOrderUpdate = (): UseOptimizedOrderUpdateReturn => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateOrder = useCallback(async (butcherId: string, order: Order) => {
    setIsUpdating(true);
    
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
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    updateOrder,
    isUpdating
  };
};
