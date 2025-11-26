/**
 * Centralized revenue calculation service
 */

export function calculateItemRevenue(
  preparingWeight: number,
  purchasePrice: number,
  commissionRate: number
): number {
  const baseRevenue = preparingWeight * purchasePrice;
  return parseFloat((baseRevenue * (1 - commissionRate)).toFixed(2));
}

/**
 * Calculate revenue for multiple items with individual failure handling
 */
export function calculateOrderRevenue(
  items: Array<{
    name: string;
    weight: number;
    purchasePrice: number;
    commissionRate: number;
  }>
): {
  totalRevenue: number;
  itemRevenues: { [itemName: string]: number };
  failedItems: string[];
  successfulItems: string[];
} {
  const itemRevenues: { [itemName: string]: number } = {};
  const failedItems: string[] = [];
  const successfulItems: string[] = [];
  let totalRevenue = 0;

  items.forEach(item => {
    try {
      if (item.purchasePrice > 0 && item.weight > 0) {
        const itemRevenue = calculateItemRevenue(item.weight, item.purchasePrice, item.commissionRate);
        itemRevenues[item.name] = itemRevenue;
        totalRevenue += itemRevenue;
        successfulItems.push(item.name);
      } else {
        console.warn(`⚠️ Invalid data for ${item.name}: price=${item.purchasePrice}, weight=${item.weight}`);
        itemRevenues[item.name] = 0;
        failedItems.push(item.name);
      }
    } catch (error) {
      console.error(`❌ Error calculating revenue for ${item.name}:`, error);
      itemRevenues[item.name] = 0;
      failedItems.push(item.name);
    }
  });

  return {
    totalRevenue,
    itemRevenues,
    failedItems,
    successfulItems
  };
}
