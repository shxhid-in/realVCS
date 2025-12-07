/**
 * Order Assignment Logic for Butcher POS System
 * This module handles intelligent assignment of orders to appropriate butchers
 */

import type { Order, OrderItem } from './types';
import { saveOrderToSheet } from './sheets';
import { getButcherConfig, getButcherType, freshButchers, CATEGORIES } from './butcherConfig';

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
  
  // Find butchers who can handle these item types using butcher config
  for (const butcher of freshButchers) {
    const config = getButcherConfig(butcher.id);
    if (!config) continue;
    
    // Get categories for this butcher
    const butcherCategories = config.categories.map(catId => {
      const category = CATEGORIES[catId as keyof typeof CATEGORIES];
      return category ? category.name.toLowerCase() : catId;
    });
    
    // Check if butcher can handle all item types
    const canHandle = Array.from(itemTypes).every(itemType => {
      // Map item types to category names
      const categoryMap: Record<string, string[]> = {
        'chicken': ['chicken'],
        'mutton': ['mutton'],
        'beef': ['beef'],
        'fish': ['sea water fish', 'fresh water fish', 'steak fish'],
        'seafood': ['sea water fish', 'fresh water fish']
      };
      
      const matchingCategories = categoryMap[itemType] || [];
      return matchingCategories.some(cat => 
        butcherCategories.some(butcherCat => butcherCat.includes(cat))
      );
    });
    
    if (canHandle) {
      possibleButchers.push(butcher.id);
    }
  }
  
  // If no specific match, assign based on item type priority
  if (possibleButchers.length === 0) {
    if (itemTypes.has('chicken') || itemTypes.has('mutton') || itemTypes.has('beef')) {
      // Meat products - find first meat butcher
      const meatButcher = freshButchers.find(b => getButcherType(b.id) === 'meat');
      if (meatButcher) possibleButchers.push(meatButcher.id);
    } else if (itemTypes.has('fish') || itemTypes.has('seafood')) {
      // Fish items - find first fish butcher
      const fishButcher = freshButchers.find(b => getButcherType(b.id) === 'fish');
      if (fishButcher) possibleButchers.push(fishButcher.id);
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
    const butcher = freshButchers.find(b => b.id === butcherId);
    return {
      butcherId,
      butcherName: butcher?.name || butcherId,
      confidence: 'high'
    };
  } else if (possibleButchers.length > 1) {
    const butcherId = possibleButchers[0];
    const butcher = freshButchers.find(b => b.id === butcherId);
    return {
      butcherId,
      butcherName: butcher?.name || butcherId,
      confidence: 'medium'
    };
  } else {
    const defaultButcher = freshButchers.find(b => b.id === 'usaj') || freshButchers[0];
    return {
      butcherId: defaultButcher?.id || 'usaj',
      butcherName: defaultButcher?.name || 'Usaj Meat Hub',
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
