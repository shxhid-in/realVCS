import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { getSheetSheetsClient } from './sheets';

// Types for D.A.M Analysis
export interface WeeklyTarget {
  week: number;
  target: number;
  achieved: number;
  percentage: number;
  status: 'pending' | 'achieved' | 'missed';
}

export interface MonthlyTarget {
  month: string;
  year: number;
  totalTarget: number;
  weeklyTargets: WeeklyTarget[];
  totalAchieved: number;
  overallPercentage: number;
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

// Initialize Google Sheets API
export const getSheetsClient = async () => {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  
  if (!clientEmail || !privateKey) {
    console.error('Missing Google credentials in salesSheets:', {
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      clientEmail: clientEmail ? 'Set' : 'Missing',
      privateKeyLength: privateKey ? privateKey.length : 0
    });
    throw new Error("Missing Google credentials in environment variables. Please check GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY.");
  }
  
  // Clean up the private key format - handle different formats
  let cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/"/g, '')
    .trim();
  
  // Ensure proper formatting
  if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
  }

  try {
  const auth = new JWT({
      email: clientEmail.replace(/"/g, ''),
      key: cleanPrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
  } catch (error) {
    console.error('Error creating Google Sheets client in salesSheets:', error);
    throw new Error(`Failed to authenticate with Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Get the Sales VCS spreadsheet ID from environment
const getSalesSpreadsheetId = () => {
  return process.env.SALES_VCS_SPREADSHEET_ID;
};

// Get butcher name by ID (matching Sales VCS sheet tab names)
const getButcherName = (butcherId: string): string => {
  const butcherNames: { [key: string]: string } = {
    'usaj': 'Usaj_Meat_Hub',
    'usaj_mutton': 'Usaj_Mutton_Shop',
    'pkd': 'PKD_Stall',
    'kak': 'KAK',
    'ka_sons': 'KA_Sons',
    'alif': 'Alif'
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

// Get butcher name for Menu POS sheet (same as Sales VCS sheet)
const getMenuButcherName = (butcherId: string): string => {
  const butcherNames: { [key: string]: string } = {
    'usaj': 'Usaj_Meat_Hub',
    'usaj_mutton': 'Usaj_Mutton_Shop',
    'pkd': 'PKD_Stall',
    'kak': 'KAK',
    'ka_sons': 'KA_Sons',
    'alif': 'Alif'
  };
  const mappedName = butcherNames[butcherId] || butcherId;
  return mappedName;
};

// Get selling price from menu sheet for an item
export const getSellingPriceFromMenu = async (
  butcherId: string,
  itemName: string
): Promise<number> => {
  const menuButcherName = getMenuButcherName(butcherId);
  
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.MENU_POS_SHEET_ID;
    
    if (!spreadsheetId) {
      console.error('Menu POS Spreadsheet ID not found');
      return 0;
    }
    
    // Determine the correct column range and selling price column based on butcher type
    const isMeatButcher = ['usaj', 'usaj_mutton', 'pkd'].includes(butcherId);
    const sellingPriceColumn = isMeatButcher ? 3 : 4; // Column D for meat, Column E for fish
    const rangeEnd = isMeatButcher ? 'D' : 'E';
    
    // Get menu data from butcher's tab
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${menuButcherName}!A:${rangeEnd}`,
    });

    const rows = response.data.values || [];
    // Check the header row to see what columns are available
    if (rows.length > 0) {
    }
    
    // Skip header row
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > sellingPriceColumn) {
        const menuItemName = row[0]?.toString().trim(); // Item name in column A
        const sellingPrice = parseFloat(row[sellingPriceColumn]) || 0; // Selling price in correct column
        
        console.log(`Row ${i}: Checking menu item: "${menuItemName}" (price: ${sellingPrice}) against search: "${itemName}"`);
        
        // Try exact case-sensitive and space-sensitive match first
        if (menuItemName === itemName) {
          console.log(`✅ Found selling price for ${itemName}: ${sellingPrice} (exact match with: ${menuItemName})`);
          return sellingPrice;
        }
        
        // If no exact match, try case-insensitive match
        if (menuItemName?.toLowerCase() === itemName.toLowerCase()) {
          console.log(`✅ Found selling price for ${itemName}: ${sellingPrice} (case-insensitive match with: ${menuItemName})`);
          return sellingPrice;
        }
        
        // For fish butchers, try to extract English name from three-language format and handle size
        // Format: "Malayalam - English - Arabic" or "English - Arabic" or just "English"
        if (!isMeatButcher && itemName.includes(' - ')) {
          const parts = itemName.split(' - ');
          let englishName = '';
          
          // Try to find the English part (usually the middle part or first part)
          if (parts.length >= 2) {
            // If we have 3 parts, the middle one is usually English
            // If we have 2 parts, the first one is usually English
            englishName = parts.length === 3 ? parts[1].trim() : parts[0].trim();
          }
          
          // Try exact match with English name
          if (englishName && menuItemName === englishName) {
            console.log(`✅ Found selling price for ${itemName} (exact English match: ${englishName}): ${sellingPrice} (matched with: ${menuItemName})`);
            return sellingPrice;
          }
          
          // Try case-insensitive match with English name
          if (englishName && menuItemName?.toLowerCase() === englishName.toLowerCase()) {
            console.log(`✅ Found selling price for ${itemName} (case-insensitive English match: ${englishName}): ${sellingPrice} (matched with: ${menuItemName})`);
            return sellingPrice;
          }
        }
        
        // Additional case-insensitive matching for both meat and fish butchers
        // Try to match by removing extra spaces and normalizing case
        const normalizedItemName = itemName.toLowerCase().trim();
        const normalizedMenuItemName = menuItemName?.toLowerCase().trim();
        
        if (normalizedMenuItemName === normalizedItemName) {
          console.log(`✅ Found selling price for ${itemName} (case-insensitive match): ${sellingPrice} (matched with: ${menuItemName})`);
          return sellingPrice;
        }
        
        // For fish butchers, also try case-insensitive matching with extracted English name
        if (!isMeatButcher && itemName.includes(' - ')) {
          const parts = itemName.split(' - ');
          let englishName = '';
          
          if (parts.length >= 2) {
            englishName = parts.length === 3 ? parts[1].trim() : parts[0].trim();
          }
          
          if (englishName && normalizedMenuItemName === englishName.toLowerCase().trim()) {
            console.log(`✅ Found selling price for ${itemName} (case-insensitive English match): ${sellingPrice} (matched with: ${menuItemName})`);
            return sellingPrice;
          }
        }
      } else {
        console.log(`Row ${i}: Skipping row with insufficient columns (${row.length} columns, need ${sellingPriceColumn + 1})`);
      }
    }
    
    // If no exact match found, try partial matching for debugging
    console.log(`No exact match found for "${itemName}". Available menu items:`);
    
    // Show extracted English name for fish butchers
    if (!isMeatButcher && itemName.includes(' - ')) {
      const parts = itemName.split(' - ');
      const englishName = parts.length === 3 ? parts[1].trim() : parts[0].trim();
      console.log(`Extracted English name: "${englishName}"`);
    }
    
    for (let i = 1; i < Math.min(rows.length, 6); i++) { // Show first 5 items for debugging
      const row = rows[i];
      if (row.length > 0) {
        const menuItemName = row[0]?.toString().trim();
        console.log(`  - "${menuItemName}"`);
      }
    }
    
    console.warn(`Selling price not found for item: ${itemName} in butcher: ${butcherId} (tab: ${menuButcherName})`);
    return 0;
  } catch (error) {
    console.error('Error getting selling price from menu:', error);
    console.error('Butcher ID:', butcherId, 'Menu Tab Name:', menuButcherName);
    return 0;
  }
};

// Save sales data to Sales VCS sheet
export const saveSalesDataToSheet = async (
  orderId: string,
  butcherId: string,
  orderData: any
): Promise<void> => {
    console.log('\n=== SALES DATA SAVING DEBUG ===');
    console.log('Order ID:', orderId);
    console.log('Butcher ID:', butcherId);
    console.log('Order Data:', orderData);
    
  try {
    console.log('Starting sales data save process...');
    
    // Check environment variables first
    console.log('Environment variables check:', {
      SALES_VCS_SPREADSHEET_ID: !!process.env.SALES_VCS_SPREADSHEET_ID,
      MENU_POS_SHEET_ID: !!process.env.MENU_POS_SHEET_ID,
      GOOGLE_SHEETS_CLIENT_EMAIL: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      GOOGLE_SHEETS_PRIVATE_KEY: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY
    });
    
    console.log('Getting Google Sheets client...');
    const sheets = await getSheetsClient();
    console.log('Google Sheets client obtained successfully');
    
    console.log('Getting Sales VCS Spreadsheet ID...');
    const spreadsheetId = getSalesSpreadsheetId();
    
    console.log('Sales VCS Spreadsheet ID:', spreadsheetId);
    console.log('Environment variable SALES_VCS_SPREADSHEET_ID:', process.env.SALES_VCS_SPREADSHEET_ID);
    
    if (!spreadsheetId) {
      console.error('❌ Sales VCS Spreadsheet ID not found in environment variables');
      console.error('Environment variables check:', {
        SALES_VCS_SPREADSHEET_ID: process.env.SALES_VCS_SPREADSHEET_ID,
        hasValue: !!process.env.SALES_VCS_SPREADSHEET_ID
      });
      throw new Error('Sales VCS Spreadsheet ID not found in environment variables. Please set SALES_VCS_SPREADSHEET_ID.');
    }

    // Test if we can access the spreadsheet
    try {
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      console.log('Spreadsheet accessible:', spreadsheetInfo.data.properties?.title);
      const availableSheets = spreadsheetInfo.data.sheets?.map(s => s.properties?.title) || [];
      console.log('Available sheets:', availableSheets);
      
      // Check if the butcher's tab exists
      const butcherName = getButcherName(butcherId);
      if (!availableSheets.includes(butcherName)) {
        console.error(`❌ Butcher tab "${butcherName}" not found in Sales VCS sheet`);
        console.error(`Available tabs: ${availableSheets.join(', ')}`);
        throw new Error(`Butcher tab "${butcherName}" not found in Sales VCS sheet. Available tabs: ${availableSheets.join(', ')}`);
      }
      console.log(`✅ Butcher tab "${butcherName}" found in Sales VCS sheet`);
    } catch (accessError) {
      console.error('Error accessing Sales VCS spreadsheet:', accessError);
      throw accessError; // Re-throw to ensure the error is propagated
    }

    // Validate butcher name mapping
    const validButcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
    if (!validButcherIds.includes(butcherId)) {
      console.error(`❌ Invalid butcher ID: ${butcherId}. Valid IDs are: ${validButcherIds.join(', ')}`);
      throw new Error(`Invalid butcher ID: ${butcherId}`);
    }
    
    const orderDate = new Date().toLocaleDateString('en-IN');
    
    // Calculate sales revenue for each item
    let totalSalesRevenue = 0;
    let totalButcherRevenue = 0;
    const itemsList: string[] = [];
    const quantitiesList: string[] = [];
    const cutTypesList: string[] = [];
    const preparingWeightsList: string[] = [];
    
    console.log('Order items:', orderData.items);
    console.log('Item quantities:', orderData.itemQuantities);
    console.log('Item weights:', orderData.itemWeights);
    
    // Helper functions for butcher type detection
    const isFishButcher = (butcherId: string) => ['kak', 'ka_sons', 'alif'].includes(butcherId);
    const isMeatButcher = (butcherId: string) => ['usaj', 'usaj_mutton', 'pkd'].includes(butcherId);

    for (const item of orderData.items) {
      const itemName = item.name;
      
      // Use the correct field based on butcher type
      let preparingWeight: number;
      if (isFishButcher(butcherId)) {
        // Fish butchers: Use itemWeights (user-entered preparing weights) first, then fallback to quantity
        preparingWeight = parseFloat(orderData.itemWeights?.[itemName] || item.quantity);
      } else {
        // Meat butchers: Use itemQuantities (user-entered preparing weights) first, then fallback to quantity
        preparingWeight = parseFloat(orderData.itemQuantities?.[itemName] || item.quantity);
      }
      
      console.log(`Processing item: ${itemName}, preparing weight: ${preparingWeight} (butcher type: ${isFishButcher(butcherId) ? 'fish' : 'meat'})`);
      
      // Use the same item mapping logic as the dashboard but for selling price
      let lookupName = itemName;
      if (isFishButcher(butcherId) && itemName.includes(' - ')) {
        const nameParts = itemName.split(' - ');
        if (nameParts.length >= 3) {
          lookupName = nameParts[1].trim(); // Use English name for lookup
        }
      }
      
      // For fish butchers' meat category items, add "meat" suffix
      const itemCategoryForLookup = item.category || '';
      const isMeatCategoryItem = isFishButcher(butcherId) && itemCategoryForLookup.toLowerCase().includes('meat');
      
      // Get selling price using enhanced matching logic
      let sellingPrice = 0;
      let matchedKey = 'none';
      
      console.log(`Looking up selling price for item: ${itemName} (lookup: ${lookupName}) in butcher: ${butcherId}`);
      
      if (isMeatButcher(butcherId)) {
        // Meat butchers: Case-sensitive exact matching
        sellingPrice = await getSellingPriceFromMenu(butcherId, itemName);
        if (sellingPrice > 0) {
          matchedKey = itemName;
        }
      } else {
        // Fish butchers: Enhanced matching without "meat" suffix
        // First, try exact case-sensitive match with English name
        sellingPrice = await getSellingPriceFromMenu(butcherId, lookupName);
        if (sellingPrice > 0) {
          matchedKey = lookupName;
        }
        // Try original item name (case-sensitive)
        if (sellingPrice === 0) {
          sellingPrice = await getSellingPriceFromMenu(butcherId, itemName);
          if (sellingPrice > 0) {
            matchedKey = itemName;
          }
        }
      }
      
      const salesRevenue = calculateSalesRevenue(preparingWeight, sellingPrice);
      
      console.log(`Item: ${itemName}, Matched Key: ${matchedKey}, Selling Price: ${sellingPrice}, Preparing Weight: ${preparingWeight}, Sales Revenue: ${salesRevenue}`);
      console.log(`Calculation: ${preparingWeight} × ${sellingPrice} = ${salesRevenue}`);
      
      // If selling price is 0, this item won't contribute to sales revenue
      if (sellingPrice === 0) {
        console.warn(`⚠️ WARNING: No selling price found for item "${itemName}" in butcher "${butcherId}". This item will have 0 sales revenue.`);
        console.warn(`This might cause the sales data upload to fail or have incomplete data.`);
      }
      
      totalSalesRevenue += salesRevenue;
      totalButcherRevenue += orderData.itemRevenues?.[itemName] || 0;
      
      itemsList.push(itemName);
      quantitiesList.push(item.quantity.toString());
      cutTypesList.push(item.cutType || '');
      preparingWeightsList.push(preparingWeight.toString());
    }
    
    console.log('Total Sales Revenue:', totalSalesRevenue);
    console.log('Total Butcher Revenue:', totalButcherRevenue);
    console.log('Margin:', totalSalesRevenue - totalButcherRevenue);
    
    // Check if we have any sales revenue at all
    if (totalSalesRevenue === 0) {
      console.warn(`⚠️ WARNING: Total sales revenue is 0 for order ${orderId}. This might indicate:`);
      console.warn(`1. No selling prices found for any items in the menu`);
      console.warn(`2. All items have 0 selling price in the menu sheet`);
      console.warn(`3. Item name matching is failing for all items`);
      console.warn(`This will result in incomplete sales data being uploaded.`);
    }
    
    const margin = totalSalesRevenue - totalButcherRevenue;
    
    // Prepare row data
    const startTime = orderData.preparationStartTime ? 
      new Date(orderData.preparationStartTime).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }) : '';
    
    const rowData = [
      orderDate,
      orderId,
      itemsList.join(', '),
      quantitiesList.join(', '),
      cutTypesList.join(', '),
      preparingWeightsList.join(', '),
      orderData.completionTime || '',
      startTime,
      orderData.status || '',
      totalSalesRevenue.toFixed(2)
    ];
    
    console.log('Row data to be saved:', rowData);
    console.log('Target range:', `${butcherName}!A:J`);
    console.log('Spreadsheet ID:', spreadsheetId);
    
    // Append to butcher's tab in Sales VCS sheet
    try {
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${butcherName}!A:J`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowData]
        }
      });
      
      console.log('Google Sheets API Response:', appendResponse.data);
      console.log('Updated range:', appendResponse.data.updates?.updatedRange);
      console.log('Updated rows:', appendResponse.data.updates?.updatedRows);
      console.log('Updated columns:', appendResponse.data.updates?.updatedColumns);
      console.log(`✅ Sales data saved for order ${orderId} in butcher ${butcherId} tab`);
    } catch (appendError) {
      console.error('❌ Error appending to Google Sheets:', appendError);
      throw appendError;
    }
    console.log('✅ Sales data upload completed successfully');
    console.log('=====================================\n');
  } catch (error) {
        console.error('❌ Error saving sales data to sheet:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : undefined,
          orderId,
          butcherId,
          spreadsheetId: getSalesSpreadsheetId()
        });
        
        // Create a more detailed error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        const detailedError = new Error(`Failed to save sales data for order ${orderId}: ${errorMessage}`);
        detailedError.name = 'SalesDataSaveError';
        throw detailedError;
      }
};

// Simplified version of saveSalesDataToSheet
export const saveSalesDataToSheetSimple = async (
  orderId: string,
  butcherId: string,
  orderData: any
): Promise<void> => {
  console.log(`\n=== SAVING SALES DATA FOR ORDER ${orderId} ===`);
  
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
  console.log(`Saving data for butcher: ${butcherId} -> ${butcherName}`);

  // Prepare order data
  const orderDate = new Date().toLocaleDateString('en-IN');
  const startTime = orderData.preparationStartTime 
    ? new Date(orderData.preparationStartTime).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }) 
    : '';

  // Process items and calculate revenue
  const itemsList: string[] = [];
  const quantitiesList: string[] = [];
  const cutTypesList: string[] = [];
  const preparingWeightsList: string[] = [];
  let totalSalesRevenue = 0;

  // Helper functions for butcher type detection
  const isFishButcher = (butcherId: string) => ['kak', 'ka_sons', 'alif'].includes(butcherId);
  const isMeatButcher = (butcherId: string) => ['usaj', 'usaj_mutton', 'pkd'].includes(butcherId);

  for (const item of orderData.items) {
    const itemName = item.name;
    
    // Use the correct field based on butcher type
    let preparingWeight: number;
    if (isFishButcher(butcherId)) {
      // Fish butchers: Use itemWeights (user-entered preparing weights) first, then fallback to quantity
      preparingWeight = parseFloat(orderData.itemWeights?.[itemName] || item.quantity);
      console.log(`Fish butcher ${butcherId} - Item: ${itemName}, itemWeights: ${orderData.itemWeights?.[itemName]}, quantity: ${item.quantity}, final weight: ${preparingWeight}`);
    } else {
      // Meat butchers: Use itemQuantities (user-entered preparing weights) first, then fallback to quantity
      preparingWeight = parseFloat(orderData.itemQuantities?.[itemName] || item.quantity);
      console.log(`Meat butcher ${butcherId} - Item: ${itemName}, itemQuantities: ${orderData.itemQuantities?.[itemName]}, quantity: ${item.quantity}, final weight: ${preparingWeight}`);
    }

    // Get selling price from menu
    const sellingPrice = await getSellingPriceFromMenu(butcherId, itemName);
    const itemRevenue = preparingWeight * sellingPrice;
    
    console.log(`${itemName}: ${preparingWeight}kg × ₹${sellingPrice} = ₹${itemRevenue}`);
    
    totalSalesRevenue += itemRevenue;
    
    itemsList.push(itemName);
    quantitiesList.push(item.quantity.toString());
    cutTypesList.push(item.cutType || '');
    preparingWeightsList.push(preparingWeight.toString());
  }

  // Prepare row data for Google Sheets
  const rowData = [
    orderDate,                    // A: Order Date
    orderId,                      // B: Order No
    itemsList.join(', '),         // C: Items
    quantitiesList.join(', '),    // D: Quantity
    cutTypesList.join(', '),      // E: Cut type
    preparingWeightsList.join(', '), // F: Preparing weight
    orderData.completionTime || '', // G: Completion Time
    startTime,                    // H: Start time
    orderData.status || '',       // I: Status
    totalSalesRevenue.toFixed(2)  // J: Revenue
  ];

  console.log(`Total revenue: ₹${totalSalesRevenue.toFixed(2)}`);
  console.log(`Saving to range: ${butcherName}!A:J`);

  // Save to Google Sheets
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${butcherName}!A:J`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData]
      }
    });

    console.log(`✅ Sales data saved successfully for order ${orderId}`);
    console.log(`Updated range: ${response.data.updates?.updatedRange}`);
    
  } catch (error) {
    console.error(`❌ Failed to save sales data for order ${orderId}:`, error);
    throw new Error(`Failed to save sales data: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Get sales data from Sales VCS sheet
export const getSalesDataFromSheet = async (
  month: number,
  year: number
): Promise<SalesData[]> => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
      return [];
    }

    const salesData: SalesData[] = [];
    const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
    
    for (const butcherId of butcherIds) {
      try {
        const butcherName = getButcherName(butcherId);
        console.log(`Fetching sales data from ${butcherName} tab for butcher ${butcherId}`);
        
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${butcherName}!A:J`,
        });

        const rows = response.data.values || [];
        console.log(`Found ${rows.length} rows in ${butcherName} tab`);
        
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 11) {
            const orderDate = row[0];
            const orderId = row[1];
            const items = row[2];
            const quantity = row[3];
            const size = row[4]; // New Size column
            const cutType = row[5]; // Moved from 4 to 5
            const preparingWeight = row[6]; // Moved from 5 to 6
            const completionTime = row[7]; // Moved from 6 to 7
            const startTime = row[8]; // Moved from 7 to 8
            const status = row[9]; // Moved from 8 to 9
            const salesRevenue = parseFloat(row[10]) || 0; // Moved from 9 to 10
            
            // Filter by month and year
            let orderDateObj: Date;
            try {
              // Try to parse DD/MM/YYYY format first
              if (orderDate.includes('/')) {
                const [day, monthStr, yearStr] = orderDate.split('/');
                if (day && monthStr && yearStr) {
                  orderDateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(day));
                } else {
                  orderDateObj = new Date(orderDate);
                }
              } else {
                orderDateObj = new Date(orderDate);
              }
            } catch (error) {
              console.warn(`Failed to parse date: ${orderDate}, using current date`);
              orderDateObj = new Date();
            }
            
            if (orderDateObj.getMonth() + 1 === month && orderDateObj.getFullYear() === year) {
              // Get butcher revenue from main sheet
              console.log(`\n=== GETTING BUTCHER REVENUE for Order ${orderId} in Butcher ${butcherId} ===`);
              const butcherRevenue = await getButcherRevenueFromMainSheet(orderId, butcherId);
              console.log(`Butcher revenue result: ${butcherRevenue}`);
              const margin = salesRevenue - butcherRevenue;
              console.log(`Margin calculation: ${salesRevenue} - ${butcherRevenue} = ${margin}`);
              
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
      } catch (error) {
        console.error(`Error reading data from ${butcherId} tab:`, error);
      }
    }
    
    return salesData;
  } catch (error) {
    console.error('Error getting sales data from sheet:', error);
    return [];
  }
};

// Save monthly target to sheet with proper column structure
export const saveDAMTargetToSheet = async (
  month: number,
  year: number,
  totalTarget: number
): Promise<void> => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
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

    // Check if target already exists for this month/year
    const existingTarget = await getDAMTargetFromSheet(month, year);
    
    if (existingTarget) {
      // Update existing target
      await updateExistingTarget(sheets, spreadsheetId, month, year, totalTarget, weeklyTargets);
    } else {
      // Add new target
    const targetData = [
        [month, year, totalTarget, JSON.stringify(weeklyTargets), 0, 0, new Date().toISOString()]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
        range: 'Target!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: targetData
      }
    });
    }

    console.log(`Monthly target saved: ${month}/${year} - ₹${totalTarget}`);
  } catch (error) {
    console.error('Error saving DAM target to sheet:', error);
  }
};

// Ensure Target tab has proper headers
const ensureTargetTabHeaders = async (sheets: any, spreadsheetId: string) => {
  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A1:G1',
    });

    const existingHeaders = response.data.values?.[0] || [];
    
    // If headers don't exist or are incomplete, add them
    if (existingHeaders.length < 7) {
      const headers = [
        'Month',
        'Year', 
        'Total Target (₹)',
        'Weekly Targets (JSON)',
        'Total Achieved (₹)',
        'Overall Percentage (%)',
        'Last Updated'
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Target!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      console.log('Target tab headers created/updated');
    }
  } catch (error) {
    console.error('Error ensuring Target tab headers:', error);
  }
};

// Update existing target in the sheet
const updateExistingTarget = async (
  sheets: any, 
  spreadsheetId: string, 
  month: number, 
  year: number, 
  totalTarget: number, 
  weeklyTargets: WeeklyTarget[]
) => {
  try {
    // Find the row with the existing target
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
      // Update the existing row
      const updateData = [
        [month, year, totalTarget, JSON.stringify(weeklyTargets), 0, 0, new Date().toISOString()]
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Target!A${targetRowIndex}:G${targetRowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: updateData
        }
      });

      console.log(`Updated existing target for ${month}/${year}`);
    }
  } catch (error) {
    console.error('Error updating existing target:', error);
  }
};

// Save comprehensive D.A.M analysis data to Target tab
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
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
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

    console.log(`D.A.M analysis data saved for ${month}/${year}`);
  } catch (error) {
    console.error('Error saving D.A.M analysis data:', error);
  }
};

// Get D.A.M analysis data from Target tab
export const getDAMAnalysisData = async (
  month: number,
  year: number
): Promise<any | null> => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
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
  } catch (error) {
    console.error('Error getting D.A.M analysis data:', error);
    return null;
  }
};

// Get monthly target from sheet
export const getDAMTargetFromSheet = async (
  month: number,
  year: number
): Promise<MonthlyTarget | null> => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
      return null;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Target!A:G',
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
          const weeklyTargets = JSON.parse(row[3] || '[]');
          const totalAchieved = parseFloat(row[4]) || 0;
          const overallPercentage = parseFloat(row[5]) || 0;
          
          return {
            month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
            year,
            totalTarget,
            weeklyTargets,
            totalAchieved,
            overallPercentage
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting DAM target from sheet:', error);
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
        } catch (error) {
          console.warn(`Failed to parse date: ${order.orderDate}, using current date`);
          orderDate = new Date();
        }
        
        // Calculate week number (1-4 for the month)
        const dayOfMonth = orderDate.getDate();
        const week = Math.ceil(dayOfMonth / 7);
        
        console.log(`Order ${order.orderId}: date=${order.orderDate}, dayOfMonth=${dayOfMonth}, week=${week}`);
        
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
      } catch (error) {
        console.warn(`Failed to parse date: ${order.orderDate}, using current date`);
        orderDate = new Date();
      }
      
      // Calculate week number (1-4 for the month)
      const dayOfMonth = orderDate.getDate();
      const week = Math.ceil(dayOfMonth / 7);
      
      console.log(`Fallback - Order ${order.orderId}: date=${order.orderDate}, dayOfMonth=${dayOfMonth}, week=${week}`);
      
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
  } catch (error) {
    console.error('Error calculating weekly targets:', error);
    return [];
  }
};

// Update weekly targets in the sheet
const updateWeeklyTargetsInSheet = async (
  month: number,
  year: number,
  weeklyTargets: WeeklyTarget[]
) => {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = getSalesSpreadsheetId();
    
    if (!spreadsheetId) {
      console.error('Sales VCS Spreadsheet ID not found');
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

      console.log(`Updated weekly targets for ${month}/${year}`);
    }
  } catch (error) {
    console.error('Error updating weekly targets in sheet:', error);
  }
};

// Get butcher revenue from main butcher POS sheet
export const getButcherRevenueFromMainSheet = async (orderId: string, butcherId: string): Promise<number> => {
  try {
    // Use the main butcher POS sheet client, not the sales VCS sheet client
    const mainSheets = await getMainSheetsClient();
    const spreadsheetId = process.env.BUTCHER_POS_SHEET_ID;
    
    if (!spreadsheetId) {
      console.log('Main butcher POS spreadsheet ID not found');
      return 0;
    }
    
    const butcherName = getButcherName(butcherId);
    console.log(`Looking for order ${orderId} in main sheet ${butcherName} tab`);
    
    const response = await mainSheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${butcherName}!A:Z`, // Read more columns to find the Revenue column
    });

    const rows = response.data.values || [];
    console.log(`Found ${rows.length} rows in main sheet ${butcherName} tab`);
    
    // Find the Revenue column index
    let revenueColumnIndex = -1;
    if (rows.length > 0) {
      const headerRow = rows[0];
      for (let i = 0; i < headerRow.length; i++) {
        if (headerRow[i] && headerRow[i].toLowerCase().includes('revenue')) {
          revenueColumnIndex = i;
          console.log(`Found Revenue column at index ${i}`);
          break;
        }
      }
    }
    
    if (revenueColumnIndex === -1) {
      console.log('Revenue column not found in main sheet');
      return 0;
    }
    
    // Extract simple order number from full order ID
    // Full order ID format: ORD-YYYY-MM-DD-NNNN
    // Simple order number: NNNN (last part after the last dash)
    const simpleOrderId = orderId.includes('-') ? orderId.split('-').pop() : orderId;
    console.log(`Extracted simple order ID: "${simpleOrderId}" from full order ID: "${orderId}"`);
    
    // Find the order by simple ID and extract revenue
    console.log(`Searching for order ${simpleOrderId} in ${rows.length} rows...`);
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      console.log(`Row ${i}: orderId="${row[1]}", looking for "${simpleOrderId}"`);
      if (row.length > 1 && row[1] === simpleOrderId) {
        const revenueStr = row[revenueColumnIndex] || '';
        console.log(`✅ Found order ${simpleOrderId} (from ${orderId}), revenue string: "${revenueStr}"`);
        
        // Handle comma-separated revenues for multiple items
        if (revenueStr.includes(',')) {
          const revenues = revenueStr.split(',').map(r => parseFloat(r.trim()) || 0);
          const totalRevenue = revenues.reduce((sum, rev) => sum + rev, 0);
          console.log(`Multiple item revenues: ${revenues}, total: ${totalRevenue}`);
          return totalRevenue;
        } else {
          const revenue = parseFloat(revenueStr) || 0;
          console.log(`Single item revenue: ${revenue}`);
          return revenue;
        }
      }
    }
    
    console.log(`❌ Order ${simpleOrderId} (from ${orderId}) not found in main sheet ${butcherName} tab`);
    console.log(`Available order IDs in first 5 rows:`, rows.slice(1, 6).map(row => row[1]));
    return 0;
  } catch (error) {
    console.error('Error getting butcher revenue from main sheet:', error);
    return 0;
  }
};

// Get main butcher POS sheet client (separate from sales VCS sheet client)
export const getMainSheetsClient = async () => {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  
  if (!clientEmail || !privateKey) {
    console.error('Missing Google credentials for main sheet:', {
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
      clientEmail: clientEmail ? 'Set' : 'Missing',
      privateKeyLength: privateKey ? privateKey.length : 0
    });
    throw new Error("Missing Google credentials in environment variables. Please check GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY.");
  }
  
  // Clean up the private key format - handle different formats
  let cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/"/g, '')
    .trim();
  
  // Ensure proper formatting
  if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
  }

  try {
    const auth = new JWT({
      email: clientEmail.replace(/"/g, ''),
      key: cleanPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return sheets;
  } catch (error) {
    console.error('Error creating main Google Sheets client:', error);
    throw new Error(`Failed to authenticate with Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
