import { getSheetSheetsClient, getPurchasePriceFromMenu } from './sheets';
import { calculateItemRevenue } from './revenueService';
import { getCommissionRate, getButcherType, isFishButcher, getFishItemFullName } from './butcherConfig';
import type { Order, OrderItem } from './types';

// IST Helper Functions (matching Butcher POS format)
const getISTDate = (): string => {
  const now = new Date();
  // Get UTC time and add IST offset (5:30 = 5.5 hours)
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(utcTime + istOffset);
  
  // Format as DD/MM/YYYY
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const year = istTime.getUTCFullYear();
  
  return `${day}/${month}/${year}`;
};

const getISTDateTime = (date?: Date): string => {
  const dateToUse = date || new Date();
  // Get UTC time and add IST offset (5:30 = 5.5 hours)
  const utcTime = dateToUse.getTime() + (dateToUse.getTimezoneOffset() * 60 * 1000);
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istTime = new Date(utcTime + istOffset);
  
  // Format as DD/MM/YYYY HH:MM:SS
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const year = istTime.getUTCFullYear();
  const hours = String(istTime.getUTCHours()).padStart(2, '0');
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const getCompletionTime = (startTime?: Date, endTime?: Date): string => {
  if (!startTime || !endTime) {
    return '';
  }
  
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  
  const diffMs = end.getTime() - start.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  // If completed within 20 minutes, show as "Xmin"
  if (diffMinutes <= 20) {
    return `${diffMinutes}min`;
  }
  
  // If exceeded 20 minutes, show actual IST completion date and time
  return getISTDateTime(end);
};

// Types for D.A.M Analysis
export interface WeeklyTarget {
  week: number;
  target: number;
  achieved: number;
  percentage: number;
  status: 'pending' | 'achieved' | 'missed';
}

export interface ButcherTarget {
  butcherId: string;
  butcherName: string;
  target: number;
  achieved: number;
  percentage: number;
}

export interface MonthlyTarget {
  month: string;
  year: number;
  totalTarget: number;
  weeklyTargets: WeeklyTarget[];
  totalAchieved: number;
  overallPercentage: number;
  // New: Support for butcher-specific targets
  butcherTargets?: ButcherTarget[];
  isButcherSpecific?: boolean;
}

export interface SalesData {
  orderId: string;
  butcherId: string;
  butcherName: string;
  orderDate: string;
  items: string;
  quantity: string;
  cutType: string;
  preparingWeight: string;
  completionTime: string;
  startTime: string;
  status: string;
  salesRevenue: number;
  butcherRevenue: number;
  margin: number;
}

// Get the Sales VCS spreadsheet ID from environment
const getSalesSpreadsheetId = () => {
  return process.env.SALES_VCS_SPREADSHEET_ID;
};

// Get the Butcher POS spreadsheet ID from environment
const getButcherPOSSpreadsheetId = () => {
  return process.env.BUTCHER_POS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID;
};

// Get orders from Butcher POS sheet for a specific month/year (for target calculations)
export const getOrdersFromButcherPOSForMonth = async (
  month: number,
  year: number
): Promise<Array<{
  butcherId: string;
  butcherName: string;
  orderDate: Date;
  revenue: number;
  status: string;
}>> => {
  try {
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return [];
    }

    const sheets = await getSheetSheetsClient('pos');
    const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif', 'tender_chops', 'test_meat', 'test_fish'];
    const orders: Array<{
      butcherId: string;
      butcherName: string;
      orderDate: Date;
      revenue: number;
      status: string;
    }> = [];
    
    for (const butcherId of butcherIds) {
      try {
        const butcherName = getButcherName(butcherId);
        
        // Butcher POS Sheet structure: A:K (11 columns with Size)
        // Columns: Order Date | Order No | Items | Quantity | Size | Cut type | Preparing weight | Completion Time | Start time | Status | Revenue
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${butcherName}!A:K`,
        });

        const rows = response.data.values || [];
        
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 10) continue;
          
          const orderDate = row[0] || '';
          const statusFromSheet = row[9] || '';
          const revenueFromSheet = row[10] || '';
          
          // Only count completed orders
          const status = statusFromSheet.toLowerCase().trim();
          if (!status.includes('completed') && !status.includes('accepted')) continue;
          
          // Parse order date
          let orderDateObj: Date;
          try {
            if (orderDate.includes('/')) {
              const parts = orderDate.split(' ');
              const datePart = parts[0];
              const [day, monthStr, yearStr] = datePart.split('/');
              if (day && monthStr && yearStr) {
                orderDateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
              } else {
                continue;
              }
            } else {
              continue;
            }
          } catch {
            continue;
          }
          
          // Filter by month and year
          if (orderDateObj.getMonth() + 1 !== month || orderDateObj.getFullYear() !== year) continue;
          
          // Parse revenue
          let totalRevenue = 0;
          if (revenueFromSheet) {
            try {
              if (revenueFromSheet.includes(':')) {
                // New format: "item: revenue, item: revenue"
                const revenueParts = revenueFromSheet.split(',').map((part: string) => part.trim());
                revenueParts.forEach((part: string) => {
                  if (part.includes(':')) {
                    const [, revenueStr] = part.split(':').map((s: string) => s.trim());
                    const revenue = parseFloat(revenueStr);
                    if (!isNaN(revenue)) {
                      totalRevenue += revenue;
                    }
                  }
                });
              } else {
                // Old format: comma-separated numbers
                const revenues = revenueFromSheet.split(',').map((r: string) => parseFloat(r.trim()) || 0);
                totalRevenue = revenues.reduce((sum: number, rev: number) => sum + rev, 0);
              }
            } catch {
              totalRevenue = parseFloat(revenueFromSheet) || 0;
            }
          }
          
          orders.push({
            butcherId,
            butcherName,
            orderDate: orderDateObj,
            revenue: totalRevenue,
            status: statusFromSheet
          });
        }
      } catch {
        // Continue with other butchers
      }
    }
    
    return orders;
  } catch {
    return [];
  }
};

// Get butcher name by ID (matching Sales VCS sheet tab names)
const getButcherName = (butcherId: string): string => {
  const butcherNames: { [key: string]: string } = {
    'usaj': 'Usaj_Meat_Hub',
    'usaj_mutton': 'Usaj_Mutton_Shop',
    'pkd': 'PKD_Stall',
    'kak': 'KAK',
    'ka_sons': 'KA_Sons',
    'alif': 'Alif',
    'tender_chops': 'Tender_Chops',
    'test_fish': 'Test_Fish_Butcher',
    'test_meat': 'Test_Meat_Butcher'
  };
  const mappedName = butcherNames[butcherId] || butcherId;
  return mappedName;
};

// Calculate sales revenue using selling price (no commission deduction)
export const calculateSalesRevenue = (
  preparingWeight: number,
  sellingPrice: number
): number => {
  return preparingWeight * sellingPrice;
};

// Main function for saving sales data to Sales VCS sheet
// This function saves order data to the Sales VCS sheet when an order is marked as prepared/completed.
// It uses cached order data (with revenue and preparing weights) from when the order was accepted.
export const saveSalesDataToSheet = async (
  orderId: string,
  butcherId: string,
  orderData: any
): Promise<void> => {
  // Validate inputs
  if (!orderId || !butcherId || !orderData) {
    throw new Error('Missing required parameters: orderId, butcherId, or orderData');
  }

  // Check environment variables
  const spreadsheetId = process.env.SALES_VCS_SPREADSHEET_ID;
  
  if (!spreadsheetId) {
    throw new Error('SALES_VCS_SPREADSHEET_ID environment variable is not set');
  }

  // Get Google Sheets client using sheet-specific service account
  const sheets = await getSheetSheetsClient('sales');
  
  // Get butcher name mapping
  const butcherName = getButcherName(butcherId);

  // Order Date: IST date (DD/MM/YYYY)
  const orderDate = getISTDate();
  
  // Order No: Extract numbers only from order ID (e.g., "ORD-2024-01-15-123" -> "123")
  const orderIdParts = orderId.replace('ORD-', '').split('-');
  const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10).toString();

  // Process items and calculate revenue
  const itemsList: string[] = [];
  const quantitiesList: string[] = [];
  const cutTypesList: string[] = [];
  const preparingWeightsParts: string[] = []; // Format: item: weight or item: rejected
  const revenueParts: string[] = []; // Format: item: revenue
  let totalSalesRevenue = 0;

  // Helper functions for butcher type detection (use getButcherType)
  const fishButcher = getButcherType(butcherId) === 'fish';
  const meatButcher = getButcherType(butcherId) === 'meat';

  for (const item of orderData.items) {
    const itemName = item.name;
    // Use fishButcher from above
    const rejected = (item as any).rejected;

    // Preparing Weight: Format as item: weight or item: rejected (no curly braces)
    if (rejected) {
      preparingWeightsParts.push(`${itemName}: rejected`);
    } else {
      // Get preparing weight from itemWeights (fish) or itemQuantities (meat)
      // For meat butchers, use itemQuantities; for fish butchers, use itemWeights
      const preparingWeight = fishButcher
        ? orderData.itemWeights?.[itemName] ?? item.quantity
        : orderData.itemQuantities?.[itemName] ?? item.quantity;
      
      // Keep unit as is (no trimming)
      preparingWeightsParts.push(`${itemName}: ${preparingWeight}`);
    }

    // Reuse calculated revenue from orderData.itemRevenues (no recalculation)
    if (!rejected) {
      const itemSize = item.size || 'default'; // Get size from order item
      const itemKey = `${itemName}_${itemSize}`;
      
      // Try to get revenue from orderData.itemRevenues first
      let itemRevenue = 0;
      if (orderData.itemRevenues && orderData.itemRevenues[itemKey] !== undefined) {
        // Reuse calculated revenue
        itemRevenue = orderData.itemRevenues[itemKey];
        totalSalesRevenue += itemRevenue;
        revenueParts.push(`${itemName}: ${itemRevenue.toFixed(2)}`);
      } else if (orderData.revenue && orderData.items.length > 0) {
        // Fallback: If itemRevenues not available but total revenue is, distribute proportionally
        // This should rarely happen as revenue should be calculated when order is accepted
        const totalQuantity = orderData.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
        const itemProportion = totalQuantity > 0 ? (item.quantity || 0) / totalQuantity : 0;
        itemRevenue = orderData.revenue * itemProportion;
        totalSalesRevenue += itemRevenue;
        revenueParts.push(`${itemName}: ${itemRevenue.toFixed(2)}`);
      } else {
        // Last resort: Calculate revenue (should not happen in normal flow)
    const preparingWeight = parseFloat(
      fishButcher
        ? orderData.itemWeights?.[itemName] ?? item.quantity
        : orderData.itemQuantities?.[itemName] ?? item.quantity
    );
        const { price: purchasePrice, category: menuCategory } = await getPurchasePriceFromMenu(butcherId, itemName, itemSize);
        // Use category from menu (found when looking up price) instead of item.category
        const category = menuCategory || item.category || 'default';
        const commissionRate = getCommissionRate(butcherId, category);
        itemRevenue = calculateItemRevenue(preparingWeight, purchasePrice, commissionRate);
    totalSalesRevenue += itemRevenue;
      revenueParts.push(`${itemName}: ${itemRevenue.toFixed(2)}`);
      }
    }

    itemsList.push(itemName);
    quantitiesList.push(item.quantity.toString());
    cutTypesList.push(item.cutType || '');
  }

  // Completion Time: Use helper function (Xmin or IST date/time if exceeded)
  const completionTime = getCompletionTime(
    orderData.preparationStartTime ? new Date(orderData.preparationStartTime) : undefined,
    orderData.preparationEndTime ? new Date(orderData.preparationEndTime) : undefined
  );

  // Start Time: IST date/time format (DD/MM/YYYY HH:MM:SS)
  const startTime = orderData.preparationStartTime 
    ? getISTDateTime(new Date(orderData.preparationStartTime))
    : '';

  // Status: Only "completed" or "rejected"
  // - "completed" if any items completed (partial or full)
  // - "rejected" only if entire order is rejected
  let sheetStatus = '';
  const allItemsRejected = orderData.items.every((item: any) => item.rejected);
  const hasAcceptedItems = orderData.items.some((item: any) => !item.rejected);
  
  if (orderData.status === 'rejected' || allItemsRejected) {
    sheetStatus = 'rejected';
  } else if (hasAcceptedItems || orderData.status === 'completed' || orderData.status === 'prepared') {
    sheetStatus = 'completed';
  } else {
    sheetStatus = orderData.status || '';
  }

  // Revenue: Format as item: revenue, item: revenue (comma-separated)
  const revenueForSheet = revenueParts.join(', ');

  // Prepare row data for Google Sheets
  const rowData = [
    orderDate,                    // A: Order Date (IST format DD/MM/YYYY)
    orderNo,                      // B: Order No (numbers only)
    itemsList.join(', '),         // C: Items
    quantitiesList.join(', '),    // D: Quantity
    cutTypesList.join(', '),      // E: Cut type
    preparingWeightsParts.join(', '), // F: Preparing weight (item: weight or item: rejected)
    completionTime,                // G: Completion Time (Xmin or IST date/time)
    startTime,                    // H: Start time (IST format DD/MM/YYYY HH:MM:SS)
    sheetStatus,                  // I: Status (only "completed" or "rejected")
    revenueForSheet               // J: Revenue (item: revenue, item: revenue)
  ];

  // Save to Google Sheets
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${butcherName}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData]
      }
    });
    
  } catch (error) {
    throw new Error(`Failed to save sales data: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Get sales data from Sales VCS sheet
export const getSalesDataFromSheet = async (
  month: number,
  year: number
): Promise<SalesData[]> => {
  try {
    const sheets = await getSheetSheetsClient('sales');
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      return [];
    }

    const salesData: SalesData[] = [];
    const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif', 'tender_chops', 'test_meat', 'test_fish'];
    
    for (const butcherId of butcherIds) {
      try {
        const butcherName = getButcherName(butcherId);
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${butcherName}!A:J`,
        });

        const rows = response.data.values || [];
        
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 10) {
            const orderDate = row[0] || ''; // A: Order Date (IST format DD/MM/YYYY)
            const orderNo = row[1] || ''; // B: Order No (numbers only)
            const items = row[2] || ''; // C: Items
            const quantity = row[3] || ''; // D: Quantity
            const cutType = row[4] || ''; // E: Cut type
            const preparingWeight = row[5] || ''; // F: Preparing weight (item: weight or item: rejected)
            const completionTime = row[6] || ''; // G: Completion Time (Xmin or IST date/time)
            const startTime = row[7] || ''; // H: Start time (IST format DD/MM/YYYY HH:MM:SS)
            const status = row[8] || ''; // I: Status (only "completed" or "rejected")
            const revenueFromSheet = row[9] || ''; // J: Revenue (item: revenue, item: revenue)
            
            // Parse revenue from new format: "item: revenue, item: revenue"
            // Sum all item revenues to get total sales revenue
            let salesRevenue = 0;
            if (revenueFromSheet) {
              try {
                // Split by comma and parse each "item: revenue" pair
                const revenueParts = revenueFromSheet.split(',').map((part: string) => part.trim());
                revenueParts.forEach((part: string) => {
                  if (part.includes(':')) {
                    const [, revenueStr] = part.split(':').map((s: string) => s.trim());
                    const revenue = parseFloat(revenueStr);
                    if (!isNaN(revenue)) {
                      salesRevenue += revenue;
                    }
                  } else {
                    // Fallback: try to parse as direct number (for backward compatibility)
                    const revenue = parseFloat(part);
                    if (!isNaN(revenue)) {
                      salesRevenue += revenue;
                    }
                  }
                });
              } catch {
                // Failed to parse revenue
              }
            }
            
            // Filter by month and year
            let orderDateObj: Date;
            try {
              // Parse DD/MM/YYYY format (IST format)
              if (orderDate.includes('/')) {
                const parts = orderDate.split(' ');
                const datePart = parts[0]; // Get date part (DD/MM/YYYY)
                const [day, monthStr, yearStr] = datePart.split('/');
                if (day && monthStr && yearStr) {
                  orderDateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
                } else {
                  orderDateObj = new Date(orderDate);
                }
              } else {
                orderDateObj = new Date(orderDate);
              }
            } catch {
              orderDateObj = new Date();
            }
            
            if (orderDateObj.getMonth() + 1 === month && orderDateObj.getFullYear() === year) {
              // Reconstruct orderId from orderNo and orderDate (for backward compatibility with existing code)
              // Format: "ORD-YYYY-MM-DD-{orderNo}"
              const orderId = orderNo ? `ORD-${orderDateObj.getFullYear()}-${String(orderDateObj.getMonth() + 1).padStart(2, '0')}-${String(orderDateObj.getDate()).padStart(2, '0')}-${orderNo}` : '';
              // Get butcher revenue from main sheet
              const butcherRevenue = await getButcherRevenueFromMainSheet(orderId, butcherId);
              const margin = salesRevenue - butcherRevenue;
              
              salesData.push({
                orderId,
                butcherId,
                butcherName: getButcherName(butcherId),
                orderDate,
                items,
                quantity,
                cutType,
                preparingWeight,
                completionTime,
                startTime,
                status,
                salesRevenue,
                butcherRevenue,
                margin
              });
            }
          }
        }
      } catch {
        // Continue with other butchers
      }
    }
    
    return salesData;
  } catch {
    return [];
  }
};

// Helper function to parse comma-separated values from sheet
const parseArrayFromSheet = (str: string): string[] => {
  return str ? str.split(',').map(item => item.trim()) : [];
};

// Helper function to parse DD/MM/YYYY date format
const parseISTDate = (dateStr: string): Date => {
  if (!dateStr || !dateStr.trim()) {
    return new Date();
  }
  
  try {
    // Parse DD/MM/YYYY format
    if (dateStr.includes('/')) {
      const parts = dateStr.split(' ');
      const datePart = parts[0]; // Get date part (DD/MM/YYYY)
      const [day, month, year] = datePart.split('/');
      if (day && month && year) {
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }
    // Fallback to standard date parsing
    return new Date(dateStr);
  } catch {
    return new Date();
  }
};

/**
 * Get orders from the Sales VCS Sheet for a specific butcher
 * This function is used by the admin panel to fetch orders from Sales VCS Sheet
 * Sales VCS Sheet structure: A:J (Order Date, Order No, Items, Quantity, Cut type, Preparing weight, Completion Time, Start time, Status, Revenue)
 * Note: Sales VCS Sheet does NOT have a Size column (unlike Butcher POS Sheet)
 */
export const getOrdersFromSalesSheet = async (butcherId: string): Promise<Order[]> => {
  try {
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      throw new Error('SALES_VCS_SPREADSHEET_ID environment variable is not set');
    }

    const sheets = await getSheetSheetsClient('sales');
    const butcherName = getButcherName(butcherId);
    
    if (!butcherName) {
      throw new Error(`No butcher name found for butcher: ${butcherId}`);
    }

    // Get data from the specific butcher's tab
    // Columns: Order Date | Order No | Items | Quantity | Cut type | Preparing weight | Completion Time | Start time | Status | Revenue
    // Note: Sales VCS Sheet has A:J (10 columns), no Size column
    const range = `${butcherName}!A2:J`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values || [];
    const orders: Order[] = [];

    // Determine butcher type for column structure
    const isMeat = getButcherType(butcherId) === 'meat';
    const isFish = getButcherType(butcherId) === 'fish';

    for (const row of rows) {
      // Sales VCS Sheet structure: A:J (10 columns, no Size)
      let orderDate, orderNo, items, quantity, cutType, preparingWeight, completionTime, startTime, statusFromSheet, revenueFromSheet;
      
      [orderDate, orderNo, items, quantity, cutType, preparingWeight, completionTime, startTime, statusFromSheet, revenueFromSheet] = row;
      
      if (!orderNo) continue; // Skip empty rows

      // Parse items, quantities, and cut types
      const itemNames = parseArrayFromSheet(items || '');
      const quantities = parseArrayFromSheet(quantity || '');
      const cutTypes = parseArrayFromSheet(cutType || '');
      
      let preparingWeights: string[] = [];
      const preparingWeightsMap: { [itemName: string]: string } = {};
      const rejectedItemNames = new Set<string>();
      const itemWeights: { [itemName: string]: string } = {};
      const itemQuantities: { [itemName: string]: string } = {};

      // Parse preparing weight column (format: "item: weight" or "item: rejected")
      if (preparingWeight && preparingWeight.trim()) {
        const weightStr = preparingWeight.trim();
        
        if (weightStr.includes(': ') && weightStr.match(/[a-zA-Z]/)) {
          // Parse new format: "item: weight" or "item: rejected"
          const weightParts = weightStr.split(',').map((p: string) => p.trim()).filter((p: string) => p);
          
          weightParts.forEach((part: string) => {
            if (part.includes(': ')) {
              const colonIndex = part.indexOf(': ');
              const itemName = part.substring(0, colonIndex).trim();
              const value = part.substring(colonIndex + 2).trim();
              
              if (value.toLowerCase() === 'rejected') {
                rejectedItemNames.add(itemName);
              } else {
                preparingWeightsMap[itemName] = value;
                // Store in itemWeights or itemQuantities based on butcher type
                if (isFish) {
                  itemWeights[itemName] = value;
                } else {
                  itemQuantities[itemName] = value;
                }
              }
            }
          });
          
          // Map weights to items by name
          itemNames.forEach((itemName, index) => {
            if (preparingWeightsMap[itemName]) {
              preparingWeights[index] = preparingWeightsMap[itemName];
            } else if (!rejectedItemNames.has(itemName)) {
              preparingWeights[index] = quantities[index] || quantities[0] || '';
            }
          });
        } else {
          // Old format: Comma-separated weights (for backward compatibility)
          preparingWeights = parseArrayFromSheet(preparingWeight);
        }
      }
      
      // Fallback for meat butchers if no weights found
      if (isMeat && (preparingWeights.length === 0 || preparingWeights.every(w => !w || w.trim() === ''))) {
        preparingWeights = quantities;
      }

      // Create order items
      const orderItems: OrderItem[] = itemNames.map((itemName, index) => {
        const qty = quantities[index] || quantities[0] || '1';
        const cut = cutTypes[index] || cutTypes[0] || '';
        
        // Parse quantity and unit
        let parsedQty = 1;
        let unit: 'kg' | 'nos' = 'kg';
        
        if (qty.toLowerCase().includes('kg')) {
          parsedQty = parseFloat(qty.replace(/kg/gi, '').trim()) || 1;
          unit = 'kg';
        } else if (qty.toLowerCase().includes('nos')) {
          parsedQty = parseFloat(qty.replace(/nos/gi, '').trim()) || 1;
          unit = 'nos';
        } else {
          parsedQty = parseFloat(qty) || 1;
          unit = 'kg'; // default
        }

        // Convert English name to three-language name for fish butchers
        let displayName = itemName;
        if (isFish) {
          if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
            displayName = itemName;
          } else {
            displayName = getFishItemFullName(itemName);
          }
        }

        const orderItem: OrderItem = {
          id: `${orderNo}-${index}`,
          name: displayName,
          quantity: parsedQty,
          unit,
          cutType: cut || undefined,
          // Note: Sales VCS Sheet doesn't have Size column, so size is undefined
        };
        
        // Mark item as rejected if found in rejectedItemNames
        if (rejectedItemNames.has(itemName)) {
          (orderItem as any).rejected = 'Item rejected';
        }

        return orderItem;
      });

      // Determine order status
      let status: Order['status'] = 'new';
      let prepStartTime: Date | undefined;
      let prepEndTime: Date | undefined;
      let pickedWeight: number | undefined;
      let revenue: number | undefined;
      let itemRevenues: { [itemName: string]: number } | undefined;
      let rejectionReason: string | undefined;

      if (statusFromSheet && statusFromSheet.trim()) {
        const sheetStatus = statusFromSheet.toLowerCase().trim();
        
        if (sheetStatus.includes(' - accepted') || sheetStatus.includes(' - rejected')) {
          // Item-wise status format
          const statusParts = sheetStatus.split(',').map((s: string) => s.trim()).filter((s: string) => s);
          const hasAccepted = statusParts.some((part: string) => part.includes(' - accepted'));
          const allRejected = statusParts.length > 0 && statusParts.every((part: string) => part.includes(' - rejected'));
          
          if (allRejected) {
            status = 'rejected';
            const rejectionParts = statusParts
              .filter((part: string) => part.includes(' - rejected'))
              .map((part: string) => {
                const match = part.match(/ - rejected(?: - (.+))?$/);
                return match && match[1] ? match[1].trim() : '';
              })
              .filter((r: string) => r);
            rejectionReason = rejectionParts.join('; ') || 'Order rejected';
          } else if (hasAccepted) {
            status = completionTime && completionTime.trim() ? 'completed' : 'preparing';
          } else {
            status = 'new';
          }
        } else {
          // Simple status string
          switch (sheetStatus) {
            case 'new':
              status = 'new';
              break;
            case 'accepted':
            case 'preparing':
              status = 'preparing';
              break;
            case 'ready to pick up':
            case 'completed':
              status = 'completed';
              break;
            case 'rejected':
            case 'declined':
              status = 'rejected';
              break;
            default:
              if (sheetStatus.startsWith('rejected:')) {
                status = 'rejected';
                rejectionReason = statusFromSheet.substring(9).trim();
              } else if (preparingWeight && preparingWeight.trim()) {
                status = 'completed';
              } else {
                status = 'new';
              }
          }
        }
      } else {
        // Fallback: Determine status based on available data
        if (preparingWeight && preparingWeight.trim()) {
          status = 'completed';
        } else {
          status = 'new';
        }
      }

      // Set additional properties based on status
      if (status === 'preparing' || status === 'completed') {
        prepStartTime = startTime && startTime.trim() ? parseISTDate(startTime) : new Date();
        pickedWeight = preparingWeights.length > 0 ? preparingWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0) : undefined;
      }

      if (status === 'completed') {
        // Calculate preparation end time
        if (completionTime && completionTime.trim() && prepStartTime) {
          const completionMinutes = parseFloat(completionTime.replace(/[^\d.]/g, ''));
          if (!isNaN(completionMinutes)) {
            prepEndTime = new Date(prepStartTime.getTime() + (completionMinutes * 60 * 1000));
          } else {
            prepEndTime = new Date();
          }
        } else {
          prepEndTime = new Date();
        }
        
        // Parse revenue from sheet
        if (revenueFromSheet && revenueFromSheet.trim()) {
          const revenueStr = revenueFromSheet.trim();
          const parsedItemRevenues: { [itemName: string]: number } = {};
          
          if (revenueStr.includes(': ')) {
            // New format: "item: revenue, item: revenue"
            const revenueParts = revenueStr.split(',').map((p: string) => p.trim()).filter((p: string) => p);
            revenueParts.forEach((part: string) => {
              const colonIndex = part.indexOf(': ');
              if (colonIndex > 0) {
                const itemName = part.substring(0, colonIndex).trim();
                const revenueValue = parseFloat(part.substring(colonIndex + 2).trim()) || 0;
                if (revenueValue > 0) {
                  parsedItemRevenues[itemName] = revenueValue;
                }
              }
            });
            
            if (Object.keys(parsedItemRevenues).length > 0) {
              itemRevenues = parsedItemRevenues;
              revenue = Object.values(parsedItemRevenues).reduce((sum, rev) => sum + rev, 0);
            }
          } else {
            // Old format: Comma-separated numbers
            const revenueValues = parseArrayFromSheet(revenueFromSheet)
              .map((rev: string) => parseFloat(rev) || 0)
              .filter((rev: number) => rev > 0);
            if (revenueValues.length > 0) {
              revenue = revenueValues.reduce((sum, rev) => sum + rev, 0);
            }
          }
        }
      }

      // Parse order date and create order ID
      const orderDateObj = parseISTDate(orderDate || '');
      const orderId = orderNo ? `ORD-${orderDateObj.getFullYear()}-${String(orderDateObj.getMonth() + 1).padStart(2, '0')}-${String(orderDateObj.getDate()).padStart(2, '0')}-${orderNo}` : `ORD-${Date.now()}`;

      // Create order object
      const order: Order = {
        id: orderId,
        customerName: '', // Sales VCS Sheet doesn't have customer name
        items: orderItems,
        status,
        orderTime: orderDateObj,
        preparationStartTime: prepStartTime,
        preparationEndTime: prepEndTime,
        rejectionReason,
        pickedWeight,
        revenue,
        itemWeights: Object.keys(itemWeights).length > 0 ? itemWeights : undefined,
        itemQuantities: Object.keys(itemQuantities).length > 0 ? itemQuantities : undefined,
        itemRevenues,
        butcherId,
        butcherName: butcherName,
        _source: 'sheet',
      };

      orders.push(order);
    }

    return orders;
  } catch (error) {
    throw error;
  }
};

// Save monthly target to sheet with proper column structure
// Supports both general targets and butcher-specific targets
// Now saves to Butcher POS sheet instead of Sales VCS sheet
export const saveDAMTargetToSheet = async (
  month: number,
  year: number,
  totalTarget: number,
  butcherTargets?: Array<{ butcherId: string; butcherName: string; target: number }>
): Promise<void> => {
  try {
    const sheets = await getSheetSheetsClient('pos');
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return;
    }

    // First, ensure the Target tab has proper headers
    await ensureTargetTabHeaders(sheets, spreadsheetId);

    // Create weekly targets (split equally)
    const weeklyTarget = totalTarget / 4;
    const weeklyTargets: WeeklyTarget[] = [
      { week: 1, target: weeklyTarget, achieved: 0, percentage: 0, status: 'pending' },
      { week: 2, target: weeklyTarget, achieved: 0, percentage: 0, status: 'pending' },
      { week: 3, target: weeklyTarget, achieved: 0, percentage: 0, status: 'pending' },
      { week: 4, target: weeklyTarget, achieved: 0, percentage: 0, status: 'pending' }
    ];

    // Prepare butcher targets JSON if provided
    const butcherTargetsJson = butcherTargets && butcherTargets.length > 0 
      ? JSON.stringify(butcherTargets)
      : '';

    // Check if target already exists for this month/year
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A:H',
    });

    const rows = response.data.values || [];
    let targetRowIndex = -1;

    // Find the row with matching month and year
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) {
        const targetMonth = parseInt(row[0]);
        const targetYear = parseInt(row[1]);
    
        if (targetMonth === month && targetYear === year) {
          targetRowIndex = i + 1; // Sheet rows are 1-indexed
          break;
        }
      }
    }

    if (targetRowIndex > 0) {
      // Update existing target
      const updateData = [
        [month, year, totalTarget, JSON.stringify(weeklyTargets), 0, 0, new Date().toISOString(), butcherTargetsJson]
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Target!A${targetRowIndex}:H${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateData
        }
      });
    } else {
      // Add new target
    const targetData = [
        [month, year, totalTarget, JSON.stringify(weeklyTargets), 0, 0, new Date().toISOString(), butcherTargetsJson]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
        range: 'Target!A:H',
      valueInputOption: 'RAW',
      requestBody: {
        values: targetData
      }
    });
    }
  } catch {
    // Silent fail
  }
};

// Ensure Target tab has proper headers
const ensureTargetTabHeaders = async (sheets: any, spreadsheetId: string) => {
  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A1:H1',
    });

    const existingHeaders = response.data.values?.[0] || [];
    
    // If headers don't exist or are incomplete, add them
    if (existingHeaders.length < 8) {
      const headers = [
        'Month',
        'Year', 
        'Total Target (₹)',
        'Weekly Targets (JSON)',
        'Total Achieved (₹)',
        'Overall Percentage (%)',
        'Last Updated',
        'Butcher Targets (JSON)'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Target!A1:H1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });
    }
  } catch {
    // Silent fail
  }
};

// Update existing target in the sheet (legacy function - kept for compatibility)
const updateExistingTarget = async (
  sheets: any, 
  spreadsheetId: string, 
  month: number, 
  year: number, 
  totalTarget: number, 
  weeklyTargets: WeeklyTarget[],
  butcherTargets?: Array<{ butcherId: string; butcherName: string; target: number }>
) => {
  try {
    // Find the row with the existing target
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A:H',
    });

    const rows = response.data.values || [];
    let targetRowIndex = -1;

    // Find the row with matching month and year
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) {
        const targetMonth = parseInt(row[0]);
        const targetYear = parseInt(row[1]);
        
        if (targetMonth === month && targetYear === year) {
          targetRowIndex = i + 1; // Sheet rows are 1-indexed
          break;
        }
      }
    }

    if (targetRowIndex > 0) {
      const butcherTargetsJson = butcherTargets && butcherTargets.length > 0 
        ? JSON.stringify(butcherTargets)
        : '';
        
      // Update the existing row
      const updateData = [
        [month, year, totalTarget, JSON.stringify(weeklyTargets), 0, 0, new Date().toISOString(), butcherTargetsJson]
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Target!A${targetRowIndex}:H${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateData
        }
      });
    }
  } catch {
    // Silent fail
  }
};

// Save comprehensive D.A.M analysis data to Target tab (now uses Butcher POS sheet)
export const saveDAMAnalysisData = async (
  month: number,
  year: number,
  analysisData: {
    totalTarget: number;
    totalAchieved: number;
    overallPercentage: number;
    weeklyBreakdown: any[];
    butcherPerformance: any[];
    marginAnalysis: any;
    insights: any[];
    recommendations: any[];
  }
): Promise<void> => {
  try {
    const sheets = await getSheetSheetsClient('pos');
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return;
    }

    // Prepare comprehensive data for Target tab
    const damData = [
      [
        'DAM_ANALYSIS',
        month,
        year,
        JSON.stringify(analysisData),
        new Date().toISOString()
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Target!E:I', // Store in columns E-I to avoid conflicts with target data
      valueInputOption: 'RAW',
      requestBody: {
        values: damData
      }
    });

  } catch {
    // Silent fail
  }
};

// Get D.A.M analysis data from Target tab (now uses Butcher POS sheet)
export const getDAMAnalysisData = async (
  month: number,
  year: number
): Promise<any | null> => {
  try {
    const sheets = await getSheetSheetsClient('pos');
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!E:I',
    });

    const rows = response.data.values || [];
    
    // Find D.A.M analysis data for the specified month and year
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 5 && row[0] === 'DAM_ANALYSIS') {
        const dataMonth = parseInt(row[1]);
        const dataYear = parseInt(row[2]);
        
        if (dataMonth === month && dataYear === year) {
          return JSON.parse(row[3] || '{}');
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
};

// Get monthly target from sheet with real-time achievement calculation from Butcher POS
// Now reads targets from Butcher POS sheet instead of Sales VCS sheet
export const getDAMTargetFromSheet = async (
  month: number,
  year: number
): Promise<MonthlyTarget | null> => {
  try {
    const sheets = await getSheetSheetsClient('pos');
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A:H',
    });

    const rows = response.data.values || [];
    
    // Find target for the specified month and year
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 4) {
        const targetMonth = parseInt(row[0]);
        const targetYear = parseInt(row[1]);
        
        if (targetMonth === month && targetYear === year) {
          const totalTarget = parseFloat(row[2]);
          let storedWeeklyTargets = [];
          let butcherTargetsData = null;
          let isButcherSpecific = false;
          
          try {
            storedWeeklyTargets = JSON.parse(row[3] || '[]');
          } catch {
            storedWeeklyTargets = [];
          }
          
          // Check for butcher-specific targets (column H)
          if (row[7]) {
            try {
              butcherTargetsData = JSON.parse(row[7]);
              isButcherSpecific = butcherTargetsData && butcherTargetsData.length > 0;
            } catch {
              butcherTargetsData = null;
            }
          }
          
          // Fetch real-time achievements from Butcher POS sheet
          const posOrders = await getOrdersFromButcherPOSForMonth(month, year);
          
          // Calculate total achieved from POS data
          const totalAchieved = posOrders.reduce((sum, order) => sum + order.revenue, 0);
          const overallPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
          
          // Calculate weekly achievements
          const weeklyTarget = totalTarget / 4;
          const weeklyAchieved: { [week: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };
          
          posOrders.forEach(order => {
            const dayOfMonth = order.orderDate.getDate();
            const week = Math.min(Math.ceil(dayOfMonth / 7), 4);
            weeklyAchieved[week] += order.revenue;
          });
          
          const currentDate = new Date();
          const isCurrentMonth = currentDate.getMonth() + 1 === month && currentDate.getFullYear() === year;
          
          const weeklyTargets: WeeklyTarget[] = [1, 2, 3, 4].map(week => {
            const achieved = weeklyAchieved[week];
            const percentage = weeklyTarget > 0 ? (achieved / weeklyTarget) * 100 : 0;
            const weekEndDate = new Date(year, month - 1, week * 7);
            
            let status: 'pending' | 'achieved' | 'missed' = 'pending';
            if (percentage >= 100) {
              status = 'achieved';
            } else if (isCurrentMonth && currentDate > weekEndDate && achieved > 0) {
              status = 'missed';
            } else if (!isCurrentMonth && year < currentDate.getFullYear()) {
              status = achieved > 0 ? 'missed' : 'pending';
            } else if (!isCurrentMonth && year === currentDate.getFullYear() && month < currentDate.getMonth() + 1) {
              status = achieved > 0 ? 'missed' : 'pending';
            }
            
            return {
              week,
              target: weeklyTarget,
              achieved,
              percentage,
              status
            };
          });
          
          // Calculate butcher-specific achievements if targets are set
          let butcherTargets: ButcherTarget[] | undefined;
          if (isButcherSpecific && butcherTargetsData) {
            const butcherAchievements: { [butcherId: string]: number } = {};
            posOrders.forEach(order => {
              butcherAchievements[order.butcherId] = (butcherAchievements[order.butcherId] || 0) + order.revenue;
            });
            
            butcherTargets = butcherTargetsData.map((bt: any) => {
              const achieved = butcherAchievements[bt.butcherId] || 0;
              const percentage = bt.target > 0 ? (achieved / bt.target) * 100 : 0;
              return {
                butcherId: bt.butcherId,
                butcherName: bt.butcherName || getButcherName(bt.butcherId),
                target: bt.target,
                achieved,
                percentage
              };
            });
          }
          
          return {
            month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
            year,
            totalTarget,
            weeklyTargets,
            totalAchieved,
            overallPercentage,
            butcherTargets,
            isButcherSpecific
          };
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
};

// Calculate weekly targets with redistribution logic
export const calculateWeeklyTargets = async (
  month: number,
  year: number
): Promise<WeeklyTarget[]> => {
  try {
    const salesData = await getSalesDataFromSheet(month, year);
    const target = await getDAMTargetFromSheet(month, year);
    
    if (!target) {
      return [];
    }

    // If we have stored weekly targets, use them as base
    if (target.weeklyTargets && target.weeklyTargets.length > 0) {
      // Group sales by week to update achieved amounts
    const weeklySales = new Map<number, number>();
    
    salesData.forEach(order => {
        // Parse the order date properly
        let orderDate: Date;
        try {
          // Try to parse DD/MM/YYYY format first
          if (order.orderDate.includes('/')) {
            const [day, monthStr, yearStr] = order.orderDate.split('/');
            if (day && monthStr && yearStr) {
              orderDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
            } else {
              orderDate = new Date(order.orderDate);
            }
          } else {
            orderDate = new Date(order.orderDate);
          }
        } catch {
          orderDate = new Date();
        }
        
        // Calculate week number (1-4 for the month)
        const dayOfMonth = orderDate.getDate();
        const week = Math.ceil(dayOfMonth / 7);
        
      const currentSales = weeklySales.get(week) || 0;
      weeklySales.set(week, currentSales + order.salesRevenue);
    });

      // Update the stored weekly targets with current achieved amounts
      const updatedWeeklyTargets = target.weeklyTargets.map(week => {
        const achieved = weeklySales.get(week.week) || 0;
        const percentage = week.target > 0 ? (achieved / week.target) * 100 : 0;
        const currentDate = new Date();
        const isCurrentMonth = currentDate.getMonth() + 1 === month && currentDate.getFullYear() === year;
        const weekEndDate = new Date(year, month - 1, week.week * 7);
        
        let status: 'pending' | 'achieved' | 'missed' = 'pending';
        if (percentage >= 100) {
          status = 'achieved';
        } else if (isCurrentMonth && currentDate > weekEndDate) {
          status = 'missed';
        }

        return {
          ...week,
          achieved,
          percentage,
          status
        };
      });

      // Update the sheet with the new achieved amounts
      await updateWeeklyTargetsInSheet(month, year, updatedWeeklyTargets);

      return updatedWeeklyTargets;
    }

    // Fallback: Create new weekly targets if none exist
    const weeklySales = new Map<number, number>();
    
    salesData.forEach(order => {
      // Parse the order date properly
      let orderDate: Date;
      try {
        // Try to parse DD/MM/YYYY format first
        if (order.orderDate.includes('/')) {
          const [day, monthStr, yearStr] = order.orderDate.split('/');
          if (day && monthStr && yearStr) {
            orderDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
          } else {
            orderDate = new Date(order.orderDate);
          }
        } else {
          orderDate = new Date(order.orderDate);
        }
      } catch {
        orderDate = new Date();
      }
      
      // Calculate week number (1-4 for the month)
      const dayOfMonth = orderDate.getDate();
      const week = Math.ceil(dayOfMonth / 7);
      
      const currentSales = weeklySales.get(week) || 0;
      weeklySales.set(week, currentSales + order.salesRevenue);
    });

    // Create 4 weekly targets
    const weeklyTargets: WeeklyTarget[] = [];
    const baseWeeklyTarget = target.totalTarget / 4;

    for (let week = 1; week <= 4; week++) {
      const achieved = weeklySales.get(week) || 0;
      const percentage = baseWeeklyTarget > 0 ? (achieved / baseWeeklyTarget) * 100 : 0;
      const currentDate = new Date();
      const isCurrentMonth = currentDate.getMonth() + 1 === month && currentDate.getFullYear() === year;
      const weekEndDate = new Date(year, month - 1, week * 7);
      
      let status: 'pending' | 'achieved' | 'missed' = 'pending';
      if (percentage >= 100) {
        status = 'achieved';
      } else if (isCurrentMonth && currentDate > weekEndDate) {
        status = 'missed';
      }
      
      weeklyTargets.push({
        week,
        target: baseWeeklyTarget,
        achieved,
        percentage,
        status
      });
    }

    return weeklyTargets;
  } catch {
    return [];
  }
};

// Update weekly targets in the sheet (now uses Butcher POS sheet)
const updateWeeklyTargetsInSheet = async (
  month: number,
  year: number,
  weeklyTargets: WeeklyTarget[]
) => {
  try {
    const sheets = await getSheetSheetsClient('pos');
    const spreadsheetId = getButcherPOSSpreadsheetId();
    
    if (!spreadsheetId) {
      return;
    }

    // Find the row with the target
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A:G',
    });

    const rows = response.data.values || [];
    let targetRowIndex = -1;

    // Find the row with matching month and year
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length >= 2) {
        const targetMonth = parseInt(row[0]);
        const targetYear = parseInt(row[1]);
        
        if (targetMonth === month && targetYear === year) {
          targetRowIndex = i + 1; // Sheet rows are 1-indexed
          break;
        }
      }
    }

    if (targetRowIndex > 0) {
      // Calculate total achieved and overall percentage
      const totalAchieved = weeklyTargets.reduce((sum, week) => sum + week.achieved, 0);
      const totalTarget = weeklyTargets.reduce((sum, week) => sum + week.target, 0);
      const overallPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

      // Update the row with new data
      const updateData = [
        [
          month, 
          year, 
          totalTarget, 
          JSON.stringify(weeklyTargets), 
          totalAchieved, 
          overallPercentage, 
          new Date().toISOString()
        ]
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Target!A${targetRowIndex}:G${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateData
        }
      });
    }
  } catch {
    // Silent fail
  }
};

// Get butcher revenue from main butcher POS sheet
export const getButcherRevenueFromMainSheet = async (orderId: string, butcherId: string): Promise<number> => {
  try {
    // Use the butcher POS sheet client to read from ButcherPOS sheet
    const mainSheets = await getSheetSheetsClient('pos');
    const spreadsheetId = process.env.BUTCHER_POS_SHEET_ID;
    
    if (!spreadsheetId) {
      return 0;
    }
    
    const butcherName = getButcherName(butcherId);
    
    const response = await mainSheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${butcherName}!A:Z`, // Read more columns to find the Revenue column
    });

    const rows = response.data.values || [];
    
    // Find the Revenue column index
    let revenueColumnIndex = -1;
    if (rows.length > 0) {
      const headerRow = rows[0];
      for (let i = 0; i < headerRow.length; i++) {
        if (headerRow[i] && headerRow[i].toLowerCase().includes('revenue')) {
          revenueColumnIndex = i;
          break;
        }
      }
    }
    
    if (revenueColumnIndex === -1) {
      return 0;
    }
    
    // Extract simple order number from full order ID
    // Full order ID format: ORD-YYYY-MM-DD-NNNN
    // Simple order number: NNNN (last part after the last dash)
    const simpleOrderId = orderId.includes('-') ? orderId.split('-').pop() : orderId;
    
    // Find the order by simple ID and extract revenue
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > 1 && row[1] === simpleOrderId) {
        const revenueStr = row[revenueColumnIndex] || '';
        
        // Handle comma-separated revenues for multiple items
        if (revenueStr.includes(',')) {
          const revenues = revenueStr.split(',').map((r: string) => parseFloat(r.trim()) || 0);
          const totalRevenue = revenues.reduce((sum: number, rev: number) => sum + rev, 0);
          return totalRevenue;
        } else {
          const revenue = parseFloat(revenueStr) || 0;
          return revenue;
        }
      }
    }
    
    return 0;
  } catch {
    return 0;
  }
};
