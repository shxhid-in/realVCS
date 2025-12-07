/**
 * Order Assignment Logic for Butcher POS System
 * This module handles intelligent assignment of orders to appropriate butchers
 */

import type { Order, OrderItem } from './types';
import { saveOrderToSheet } from './sheets';

// Define butcher specializations
const BUTCHER_SPECIALIZATIONS = {
  'usaj': {
    name: 'Usaj Meat Hub',
    specializes: ['chicken', 'mutton', 'beef'],
    type: 'meat'
  },
  'pkd': {
    name: 'PKD Stall',
    specializes: ['chicken', 'mutton'],
    type: 'meat'
  },
  'alif': {
    name: 'Alif',
    specializes: ['fish', 'seafood', 'prawns', 'crab'],
    type: 'fish'
  },
  'kak': {
    name: 'KAK',
    specializes: ['fish', 'seafood', 'prawns', 'crab'],
    type: 'fish'
  },
  'ka_sons': {
    name: 'KA Sons',
    specializes: ['fish', 'seafood', 'prawns', 'crab'],
    type: 'fish'
  }
} as const;

// Item categorization for smart assignment
const ITEM_CATEGORIES = {
  // Chicken items
  'chicken': ['chicken leg', 'chicken whole', 'chicken meat', 'chicken breast', 'chicken lollipop', 'chicken parts', 'chicken nadan', 'chicken thigh'],
  
  // Mutton items  
  'mutton': ['mutton meat', 'mutton rib', 'mutton boneless', 'mutton liver', 'mutton brain', 'mutton head', 'mutton botty', 'mutton paaya'],
  
  // Beef items
  'beef': ['beef meat', 'beef boneless', 'beef bone'],
  
  // Fish items (using simplified names for matching)
  'fish': ['ayala', 'mackerel', 'mathi', 'sardine', 'karimeen', 'pearl spot', 'koonthal', 'squid', 'chemmeen', 'prawns'],
  
  // Seafood
  'seafood': ['nandu', 'crab', 'kakka', 'clam', 'tiger chemmeen', 'tiger prawns']
};

/**
 * Determines which butcher should handle an order based on items
 */
export const assignOrderToButcher = (order: Order): string[] => {
  const possibleButchers: string[] = [];
  
  // Analyze each item in the order
  const itemTypes = new Set<string>();
  
  order.items.forEach(item => {
    const itemName = item.name.toLowerCase();
    
    // Check which category this item belongs to
    for (const [category, items] of Object.entries(ITEM_CATEGORIES)) {
      if (items.some(categoryItem => itemName.includes(categoryItem.toLowerCase()))) {
        itemTypes.add(category);
        break;
      }
    }
  });
  
  // Find butchers who can handle these item types
  for (const [butcherId, butcher] of Object.entries(BUTCHER_SPECIALIZATIONS)) {
    const canHandle = Array.from(itemTypes).every(itemType => 
      butcher.specializes.some(specialization => 
        specialization === itemType || 
        (itemType === 'fish' && specialization === 'seafood') ||
        (itemType === 'seafood' && specialization === 'fish')
      )
    );
    
    if (canHandle) {
      possibleButchers.push(butcherId);
    }
  }
  
  // If no specific match, assign based on item type priority
  if (possibleButchers.length === 0) {
    if (itemTypes.has('chicken') || itemTypes.has('mutton') || itemTypes.has('beef')) {
      // Meat products - prefer Usaj (has beef) over PKD
      possibleButchers.push('usaj');
    } else if (itemTypes.has('fish') || itemTypes.has('seafood')) {
      // Fish items - assign to any fish butcher
      possibleButchers.push('alif', 'kak', 'ka_sons');
    }
  }
  
  return possibleButchers.length > 0 ? possibleButchers : ['usaj']; // Default fallback
};

/**
 * Automatically assigns and saves an order to the appropriate butcher(s)
 */
export const autoAssignOrder = async (order: Order): Promise<{ success: boolean; assignments: string[]; errors?: string[] }> => {
  const possibleButchers = assignOrderToButcher(order);
  const assignments: string[] = [];
  const errors: string[] = [];
  
  // For MVP, assign to the first suitable butcher
  // In future, you could implement load balancing or multi-assignment
  const selectedButcher = possibleButchers[0];
  
  try {
    await saveOrderToSheet(order, selectedButcher);
    assignments.push(selectedButcher);
  } catch (error: any) {
    errors.push(`Failed to assign to ${selectedButcher}: ${error.message}`);
  }
  
  return {
    success: assignments.length > 0,
    assignments,
    errors: errors.length > 0 ? errors : undefined
  };
};

/**
 * Get recommended butcher for an order (for manual assignment)
 */
export const getRecommendedButcher = (order: Order): { butcherId: string; butcherName: string; confidence: 'high' | 'medium' | 'low' } => {
  const possibleButchers = assignOrderToButcher(order);
  
  if (possibleButchers.length === 1) {
    const butcherId = possibleButchers[0];
    return {
      butcherId,
      butcherName: BUTCHER_SPECIALIZATIONS[butcherId as keyof typeof BUTCHER_SPECIALIZATIONS].name,
      confidence: 'high'
    };
  } else if (possibleButchers.length > 1) {
    const butcherId = possibleButchers[0];
    return {
      butcherId,
      butcherName: BUTCHER_SPECIALIZATIONS[butcherId as keyof typeof BUTCHER_SPECIALIZATIONS].name,
      confidence: 'medium'
    };
  } else {
    return {
      butcherId: 'usaj',
      butcherName: 'Usaj Meat Hub',
      confidence: 'low'
    };
  }
};

/**
 * Example usage for testing
 */
export const testOrderAssignment = () => {
  // Test orders
  const chickenOrder: Order = {
    id: 'ORD-001',
    customerName: 'John Doe',
    items: [
      { id: '1', name: 'Chicken Parts', quantity: 1, unit: 'kg', cutType: 'small pieces' },
      { id: '2', name: 'Chicken Breast Boneless', quantity: 0.5, unit: 'kg' }
    ],
    status: 'new',
    orderTime: new Date()
  };
  
  const fishOrder: Order = {
    id: 'ORD-002', 
    customerName: 'Jane Smith',
    items: [
      { id: '1', name: 'Ayala - Mackerel', quantity: 1, unit: 'kg', cutType: 'cleaned' },
      { id: '2', name: 'Chemmeen - Prawns', quantity: 0.5, unit: 'kg' }
    ],
    status: 'new',
    orderTime: new Date()
  };
  
  const mixedOrder: Order = {
    id: 'ORD-003',
    customerName: 'Mixed Customer', 
    items: [
      { id: '1', name: 'Chicken Parts', quantity: 1, unit: 'kg' },
      { id: '2', name: 'Ayala Fish', quantity: 1, unit: 'kg' }
    ],
    status: 'new',
    orderTime: new Date()
  };
  
};
