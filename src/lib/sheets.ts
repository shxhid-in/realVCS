'use server';

import { google } from 'googleapis';
import type { Order, OrderItem, MenuCategory, Butcher, MenuItem, CommissionRate, MarkupRate, ButcherRates } from './types';
import { 
  freshButchers as butchers, 
  getFishItemFullName,
  getButcherType,
  getButcherConfig,
  findCategoryForItem,
  getPriceSheetTab,
  getCommissionRate,
  getMarkupRate,
  getItemTypeFromCategory,
  getDefaultButcherRates
} from './butcherConfig';
import { measureApiCall } from './apiMonitor';
import {normalizeItemName} from './matchingUtils';
// Note: Caching removed from server actions due to Next.js restrictions

// Sheet configurations
const BUTCHER_POS_SHEET_ID = process.env.BUTCHER_POS_SHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || '1QYABLczgHKIXC_shTG_xrBXiLWuqziRjkaujLhg9Sl4';
const MENU_POS_SHEET_ID = process.env.MENU_POS_SHEET_ID || '1hOoZtKuyhO5H206mm3RPoHUtuMcYdoGGnARkm_plT1M';

// Tab names mapping
const BUTCHER_TABS = {
  'usaj': 'Usaj_Meat_Hub',
  'pkd': 'PKD_Stall', 
  'alif': 'Alif',
  'kak': 'KAK',
  'ka_sons': 'KA_Sons',
  'usaj_mutton': 'Usaj_Mutton_Shop',
  'test_meat': 'Test_Meat_Butcher',
  'test_fish': 'Test_Fish_Butcher'
} as const;

export const getGoogleSheetsClient = async () => {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    
    if (!clientEmail || !privateKey) {
        console.error('Missing Google credentials:', {
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
    const auth = new google.auth.GoogleAuth({
        credentials: {
                client_email: clientEmail.replace(/"/g, ''),
          private_key: cleanPrivateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        console.error('Error creating Google Sheets client:', error);
        throw new Error(`Failed to authenticate with Google Sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

// Service account mapping for 9 service accounts (6 butchers + 3 sheets)
const SERVICE_ACCOUNT_MAPPING = {
  // Butcher-specific service accounts (6 accounts)
  butcher: {
    'usaj': {
      clientEmail: process.env.BUTCHER_USAJ_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_USAJ_PRIVATE_KEY
    },
    'pkd': {
      clientEmail: process.env.BUTCHER_PKD_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_PKD_PRIVATE_KEY
    },
    'kak': {
      clientEmail: process.env.BUTCHER_KAK_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_KAK_PRIVATE_KEY
    },
    'ka_sons': {
      clientEmail: process.env.BUTCHER_KA_SONS_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_KA_SONS_PRIVATE_KEY
    },
    'alif': {
      clientEmail: process.env.BUTCHER_ALIF_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_ALIF_PRIVATE_KEY
    },
    'usaj_mutton': {
      clientEmail: process.env.BUTCHER_USAJ_MUTTON_CLIENT_EMAIL,
      privateKey: process.env.BUTCHER_USAJ_MUTTON_PRIVATE_KEY
    }
  },
  // Sheet-specific service accounts (3 accounts) - all have access to all sheets
  sheet: {
    pos: {
      clientEmail: process.env.SHEET_POS_CLIENT_EMAIL,
      privateKey: process.env.SHEET_POS_PRIVATE_KEY
    },
    menu: {
      clientEmail: process.env.SHEET_MENU_CLIENT_EMAIL,
      privateKey: process.env.SHEET_MENU_PRIVATE_KEY
    },
    sales: {
      clientEmail: process.env.SHEET_SALES_CLIENT_EMAIL,
      privateKey: process.env.SHEET_SALES_PRIVATE_KEY
    }
  }
};

// Get butcher-specific Google Sheets client
export const getButcherSheetsClient = async (butcherId: string) => {
    try {
        const credentials = SERVICE_ACCOUNT_MAPPING.butcher[butcherId as keyof typeof SERVICE_ACCOUNT_MAPPING.butcher];
        
        if (!credentials?.clientEmail || !credentials?.privateKey) {
            return getGoogleSheetsClient();
        }

        const processedPrivateKey = credentials.privateKey.replace(/\\n/g, '\n');

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.clientEmail,
                private_key: processedPrivateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const sheetsClient = google.sheets({ version: 'v4', auth: client as any });
        return sheetsClient;
    } catch (error) {
        console.error(`[Sheets] Error creating butcher-specific client for ${butcherId}:`, error);
        return getGoogleSheetsClient();
    }
};

// Get sheet-specific Google Sheets client (for operations that need specific sheet access)
export const getSheetSheetsClient = async (sheetType: 'pos' | 'menu' | 'sales') => {
    try {
        const credentials = SERVICE_ACCOUNT_MAPPING.sheet[sheetType];
        
        if (!credentials?.clientEmail || !credentials?.privateKey) {
            console.warn(`No sheet-specific credentials found for ${sheetType}, falling back to default`);
            return getGoogleSheetsClient();
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.clientEmail,
                private_key: credentials.privateKey.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        console.error(`Error creating sheet-specific Google Sheets client for ${sheetType}:`, error);
        // Fallback to default client
        return getGoogleSheetsClient();
    }
};


// Helper function to format arrays for sheet storage
const formatArrayForSheet = (items: string[]): string => {
    return items.join(',');
};

// Helper function to parse arrays from sheet
const parseArrayFromSheet = (str: string): string[] => {
    return str ? str.split(',').map(item => item.trim()) : [];
};

/**
 * Get current date and time in IST (India Standard Time)
 * Works regardless of server location
 * IST is UTC+5:30
 */
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

/**
 * Get current date and time in IST (India Standard Time) in human-readable format
 * Format: DD/MM/YYYY HH:MM:SS
 */
const getISTDateTime = (date?: Date | string | number): string => {
    // Normalize date to Date object
    let dateToUse: Date;
    if (!date) {
        dateToUse = new Date();
    } else if (date instanceof Date) {
        dateToUse = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        dateToUse = new Date(date);
    } else {
        dateToUse = new Date();
    }
    
    // Validate the date
    if (isNaN(dateToUse.getTime())) {
        dateToUse = new Date(); // Fallback to current date if invalid
    }
    
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

/**
 * Calculate completion time in minutes
 * Returns "Xmin" if within timer (20 minutes), or actual time if exceeded
 */
const getCompletionTime = (startTime?: Date | string | number, endTime?: Date | string | number): string => {
    if (!startTime || !endTime) {
        return '';
    }
    
    // Normalize dates to Date objects
    let start: Date;
    let end: Date;
    
    if (startTime instanceof Date) {
        start = startTime;
    } else if (typeof startTime === 'string' || typeof startTime === 'number') {
        start = new Date(startTime);
    } else {
        return '';
    }
    
    if (endTime instanceof Date) {
        end = endTime;
    } else if (typeof endTime === 'string' || typeof endTime === 'number') {
        end = new Date(endTime);
    } else {
        return '';
    }
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return '';
    }
    
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    // If within 20 minutes, return as "Xmin"
    if (diffMinutes <= 20) {
        return `${diffMinutes}min`;
    }
    
    // If exceeded, return actual completion time in IST
    return getISTDateTime(end);
};

// Function to populate empty sheets with default items
const populateDefaultItems = async (butcherId: string) => {
    try {
        if (!MENU_POS_SHEET_ID) {
            return;
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            return;
        }

        // Default items for each butcher type
        const defaultItems = getDefaultItemsForButcher(butcherId);
        
        if (defaultItems.length === 0) {
            return;
        }

        // Determine if this is a meat butcher (no size column)
        const isMeatButcher = getButcherType(butcherId) === 'meat';
        
        // Different column structures based on butcher type
        const range = isMeatButcher ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const values = defaultItems.map(item => {
            if (isMeatButcher) {
                // Meat butchers: Item Name, Category, Purchase Price, Selling Price, Unit, nos weight
                return [
                    item.name,
                    item.category,
                    item.purchasePrice,
                    item.sellingPrice || item.purchasePrice,
                    item.unit,
                    item.nosWeight || ''
                ];
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight
                return [
                    item.name,
                    item.category,
                    item.size || '',
                    item.purchasePrice,
                    item.sellingPrice || item.purchasePrice,
                    item.unit,
                    item.nosWeight || ''
                ];
            }
        });

        await sheets.spreadsheets.values.append({
            spreadsheetId: MENU_POS_SHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values
            }
        });

    } catch (error) {
        console.error('Error populating default items:', error);
    }
};

// Get default items for each butcher
const getDefaultItemsForButcher = (butcherId: string) => {
    const commonItems = [
        { name: 'Chicken Leg', category: 'Chicken', size: 'default', purchasePrice: 200, sellingPrice: 220, unit: 'kg', nosWeight: '' },
        { name: 'Chicken Whole', category: 'Chicken', size: 'default', purchasePrice: 180, sellingPrice: 200, unit: 'kg', nosWeight: '' },
        { name: 'Mutton Meat', category: 'Mutton', size: 'default', purchasePrice: 500, sellingPrice: 550, unit: 'kg', nosWeight: '' },
        { name: 'Mutton Liver', category: 'Mutton', size: 'default', purchasePrice: 300, sellingPrice: 330, unit: 'kg', nosWeight: '' },
    ];

    const fishItems = [
        { name: 'Mackerel', category: 'Sea Fish', size: 'small', purchasePrice: 150, sellingPrice: 170, unit: 'kg', nosWeight: '' },
        { name: 'Sardine', category: 'Sea Fish', size: 'small', purchasePrice: 120, sellingPrice: 140, unit: 'kg', nosWeight: '' },
    ];

    // Return appropriate items based on butcher type
    if (getButcherType(butcherId) === 'fish') {
        return fishItems;
    } else {
        return commonItems;
    }
};

/**
 * Fetch purchase prices from Menu POS sheet for a specific butcher
 * Updated to handle the new sheet structure with Size column
 */
const fetchPurchasePrices = async (butcherId: string): Promise<Record<string, number>> => {
    try {
        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine if this is a meat butcher (no size column)
        const isMeatButcher = getButcherType(butcherId) === 'meat';
        
        // Different column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const range = isMeatButcher ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MENU_POS_SHEET_ID,
            range,
        });

        const rows = response.data.values || [];
        const purchasePrices: Record<string, number> = {};

        for (const row of rows) {
            let itemName, size, purchasePriceStr;
            
            if (isMeatButcher) {
                // Meat butchers: Item Name, Category, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , purchasePriceStr] = row;
                size = 'default'; // Meat products don't have sizes
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , size, purchasePriceStr] = row;
            }
            
            if (!itemName || !purchasePriceStr) continue;

            const purchasePrice = parseFloat(purchasePriceStr) || 0;
            if (purchasePrice > 0) {
                // Extract English name (middle part) from three-language format
                let cleanItemName = itemName;
                if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
                    const nameParts = itemName.split(' - ');
                    cleanItemName = nameParts[1].trim(); // English name is in the middle
                }
                // For meat items (single name), use the name directly
                
                // For items with sizes, include size in the key for more precise matching
                if (size && size !== 'default') {
                    const keyWithSize = `${cleanItemName.toLowerCase().trim()} (${size.toLowerCase()})`;
                    purchasePrices[keyWithSize] = purchasePrice;
                }
                
                // Always store the base name without size for fallback matching (case-insensitive)
                purchasePrices[cleanItemName.toLowerCase().trim()] = purchasePrice;
            }
        }

        return purchasePrices;

    } catch (error) {
        console.error(`Error fetching purchase prices for ${butcherId}:`, error);
        return {};
    }
};

// Helper function to calculate completion time
const calculateCompletionTime = (startTime: Date, endTime: Date): string => {
    const diffMs = endTime.getTime() - startTime.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
};

// Helper function to calculate string similarity (Levenshtein distance based)
function calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Helper function to determine if a butcher is a meat butcher (uses getButcherType)
function isMeatButcher(butcherId: string): boolean {
    return getButcherType(butcherId) === 'meat';
}

// Helper function to determine if a butcher is a fish butcher (uses getButcherType)
function isFishButcher(butcherId: string): boolean {
    return getButcherType(butcherId) === 'fish';
}

/**
 * Get purchase prices for items from Menu POS sheet
 * Updated to handle the new sheet structure with Size column
 * New structure: Order Date | Order No | Items | Quantity | Size | Cut type | Preparing weight | Completion Time | Start time | Status | Revenue
 */
export const getItemPurchasePricesFromSheet = async (butcherId: string, itemNames: string[], orderItems?: OrderItem[]): Promise<{[itemName: string]: number}> => {
    try {
        if (!MENU_POS_SHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID_MENU_POS not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine if this is a meat butcher (no size column)
        const isMeatButcher = getButcherType(butcherId) === 'meat';
        
        // Updated column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const range = isMeatButcher ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const response = await measureApiCall(
            `getOrders:${butcherId}`,
            'GET',
            () => sheets.spreadsheets.values.get({
                spreadsheetId: MENU_POS_SHEET_ID,
                range,
            }),
            { sheetId: MENU_POS_SHEET_ID, sheetName: 'Menu POS Sheet' }
        );

        const rows = response.data.values || [];
        const prices: {[itemName: string]: number} = {};

        console.log(`Found ${rows.length} rows in sheet for ${butcherId}`);
        console.log(`Sheet structure: ${isMeatButcher ? '6 columns (meat)' : '7 columns (fish)'}`);
        console.log(`Looking for items: ${itemNames.join(', ')}`);
        console.log(`First few rows:`, rows.slice(0, 3));

        for (const row of rows) {
            let itemName, size, purchasePrice;
            
            if (isMeatButcher) {
                // Meat butchers: Item Name, Category, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , purchasePrice] = row;
                size = 'default'; // Meat products don't have sizes
                console.log(`Meat butcher row parsing:`, { 
                    itemName, 
                    purchasePrice, 
                    fullRow: row,
                    column2: row[1], // Category
                    column3: row[2], // Purchase Price
                    column4: row[3]  // Selling Price
                });
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , size, purchasePrice] = row;
                console.log(`Fish butcher row parsing:`, { 
                    itemName, 
                    size,
                    purchasePrice, 
                    fullRow: row,
                    column3: row[2], // Size
                    column4: row[3], // Purchase Price
                    column5: row[4]  // Selling Price
                });
            }
            
            console.log(`Processing sheet row:`, { itemName, size, purchasePrice, row, isMeatButcher });
            if (itemName && purchasePrice) {
                // Match item names (case sensitive for exact matching)
                const baseItemName = itemName.trim(); // Keep original case for exact matching
                const price = parseFloat(purchasePrice) || 0; // Default fallback
                
                console.log('Checking menu item:', { 
                    itemName, 
                    size,
                    baseItemName, 
                    purchasePrice, 
                    price,
                    butcherId,
                    itemNames,
                    row
                });
                
                // Check if any of the order items match this menu item
                for (const orderItemName of itemNames) {
                    const baseOrderItemName = orderItemName.trim(); // Keep original case for exact matching
                    
                    // Extract English name (middle part) from three-language format
                    let orderEnglishName = baseOrderItemName;
                    if (orderItemName.includes(' - ') && orderItemName.split(' - ').length >= 3) {
                        const nameParts = orderItemName.split(' - ');
                        orderEnglishName = nameParts[1].trim(); // English name is in the middle
                    }
                    // For meat products (single name), use the name directly
                    
                    // Get order item details for better matching
                    const orderItem = orderItems?.find(item => item.name === orderItemName);
                    const orderItemCategory = orderItem?.category?.toLowerCase().trim();
                    const orderItemSize = orderItem?.size?.toLowerCase().trim() || 'default';
                    
                    // Case-sensitive exact matching logic with size consideration
                    let isMatch = false;
                    
                    if (isMeatButcher) {
                        // Meat butchers: Exact case-sensitive and space-sensitive matching (no size consideration)
                        console.log(`Meat butcher matching: "${baseItemName}" vs "${baseOrderItemName}": ${baseItemName.toLowerCase() === baseOrderItemName.toLowerCase()}`);
                        if (baseItemName.toLowerCase() === baseOrderItemName.toLowerCase()) {
                            isMatch = true;
                            console.log(`✅ Case-insensitive match found for meat butcher: "${baseItemName}"`);
                        }
                    } else {
                        // Fish butchers: Enhanced matching with size consideration (case-sensitive and space-sensitive)
                        
                        // PRIORITY 1: Try size-specific matching first (most accurate)
                        if (orderItemSize && orderItemSize !== 'default' && size && size !== 'default') {
                            // Try format: "Trevally (Small)" - parentheses format
                            const itemWithParentheses = `${baseItemName} (${size})`;
                            const orderWithParentheses = `${baseOrderItemName} (${orderItemSize})`;
                            
                            if (itemWithParentheses.toLowerCase() === orderWithParentheses.toLowerCase()) {
                                isMatch = true;
                                console.log(`✅ Fish butcher parentheses size match: "${itemWithParentheses}" = "${orderWithParentheses}"`);
                            }
                            
                            // Try format: "Trevally Small" - space format
                            if (!isMatch) {
                                const itemWithSize = `${baseItemName} ${size}`;
                                const orderWithSize = `${baseOrderItemName} ${orderItemSize}`;
                                
                                if (itemWithSize.toLowerCase() === orderWithSize.toLowerCase()) {
                                    isMatch = true;
                                    console.log(`✅ Fish butcher space size match: "${itemWithSize}" = "${orderWithSize}"`);
                                }
                            }
                        }
                        
                        // PRIORITY 2: If no size-specific match, try English name with size validation
                        if (!isMatch && baseItemName.toLowerCase() === orderEnglishName.toLowerCase()) {
                            // Check if sizes match (if both have sizes)
                            if (size && size !== 'default' && orderItemSize && orderItemSize !== 'default') {
                                if (size.toLowerCase() === orderItemSize.toLowerCase()) {
                                    isMatch = true;
                                    console.log(`✅ Fish butcher English name with size match: "${baseItemName}" + "${size}"`);
                                }
                            } else if (!size || size === 'default' || !orderItemSize || orderItemSize === 'default') {
                                // If either doesn't have size, match by name only (case-insensitive)
                                isMatch = true;
                                console.log(`✅ Fish butcher English name match (case-insensitive): "${baseItemName}"`);
                            }
                        }
                        
                        // No longer using "meat" suffix for fish butchers' steak fish items
                        // Fish butchers will match items using original names
                        
                        // Try exact match with original item name (case-insensitive)
                        if (!isMatch && baseItemName.toLowerCase() === baseOrderItemName.toLowerCase()) {
                            // Check size match
                            if (size && size !== 'default' && orderItemSize && orderItemSize !== 'default') {
                                if (size.toLowerCase() === orderItemSize) {
                            isMatch = true;
                                    console.log(`✅ Fish butcher original name with size match: "${baseItemName}" + "${size}"`);
                                }
                            } else if (!size || size === 'default' || !orderItemSize || orderItemSize === 'default') {
                                isMatch = true;
                                console.log(`✅ Fish butcher original name match: "${baseItemName}"`);
                            }
                        }
                        // If meat category item, try original name with "meat" suffix (case-insensitive)
                        else if (orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                 baseItemName.toLowerCase() === `${baseOrderItemName} meat`.toLowerCase()) {
                            // Check size match
                            if (size && size !== 'default' && orderItemSize && orderItemSize !== 'default') {
                                if (size.toLowerCase() === orderItemSize) {
                            isMatch = true;
                                }
                            } else if (!size || size === 'default' || !orderItemSize || orderItemSize === 'default') {
                                isMatch = true;
                            }
                        }
                    }
                    
                    console.log('Size-aware matching attempt:', {
                        orderItem: orderItemName,
                        baseOrderItemName,
                        orderEnglishName,
                        orderItemCategory,
                        orderItemSize,
                        menuItem: itemName,
                        baseItemName,
                        menuItemSize: size,
                        isMeatButcher,
                        isMatch,
                        sizeMatch: size && size !== 'default' && orderItemSize && orderItemSize !== 'default' ? 
                                   size.toLowerCase() === orderItemSize : 'no size comparison needed',
                        exactMatchOriginal: baseItemName.toLowerCase() === baseOrderItemName.toLowerCase(),
                        exactMatchEnglish: !isMeatButcher && baseItemName.toLowerCase() === orderEnglishName.toLowerCase(),
                        meatSuffixMatchEnglish: !isMeatButcher && orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                             baseItemName.toLowerCase() === `${orderEnglishName} meat`.toLowerCase(),
                        meatSuffixMatchOriginal: !isMeatButcher && orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                               baseItemName.toLowerCase() === `${baseOrderItemName} meat`.toLowerCase()
                    });
                    
                    // Special debugging for ayakoora meat
                    if (orderItemName.toLowerCase().includes('ayakoora') || itemName.toLowerCase().includes('ayakoora')) {
                        console.log('🔍 AYAKOORA DEBUG:', {
                            orderItem: orderItemName,
                            menuItem: itemName,
                            baseOrderItemName,
                            baseItemName,
                            orderEnglishName,
                            orderItemSize,
                            menuItemSize: size,
                            isExactMatch: baseItemName.toLowerCase() === baseOrderItemName.toLowerCase() || baseItemName.toLowerCase() === orderEnglishName.toLowerCase(),
                            isPartialMatch: baseItemName.toLowerCase().includes(baseOrderItemName.toLowerCase()) || baseOrderItemName.toLowerCase().includes(baseItemName.toLowerCase()) ||
                                         baseItemName.toLowerCase().includes(orderEnglishName.toLowerCase()) || orderEnglishName.toLowerCase().includes(baseItemName.toLowerCase()),
                            fuzzyMatch: baseItemName.replace(/[^a-z]/g, '') === baseOrderItemName.replace(/[^a-z]/g, '') ||
                                      baseItemName.replace(/[^a-z]/g, '') === orderEnglishName.replace(/[^a-z]/g, ''),
                            isMatch,
                            price: purchasePrice
                        });
                    }
                    
                    if (isMatch) {
                        prices[orderItemName] = price;
                        console.log(`✅ Matched: ${orderItemName} -> ${itemName} (size: ${size}, order size: ${orderItemSize}, ₹${price})`);
                    }
                }
            }
        }

        // If sheet is completely empty, populate with some default items
        if (rows.length === 0) {
            console.log(`Sheet is empty for ${butcherId}, populating with default items`);
            await populateDefaultItems(butcherId);
        }

        // Set default price for items not found, but try one more fuzzy match attempt
        itemNames.forEach(itemName => {
            if (!prices[itemName]) {
                console.log(`❌ No exact price found for ${itemName}, trying fuzzy match...`);
                
                // Try to find a close match by comparing cleaned names
                const cleanedOrderName = itemName.toLowerCase().replace(/[^a-z]/g, '');
                let bestMatch = null;
                let bestMatchPrice = 0;
                
                for (const row of rows) {
                    let itemName, size, purchasePrice;
                    
                    if (isMeatButcher) {
                        [itemName, , purchasePrice] = row;
                        size = 'default';
                    } else {
                        [itemName, , size, purchasePrice] = row;
                    }
                    
                    const cleanedMenuName = itemName.toLowerCase().replace(/[^a-z]/g, '');
                    
                    // Check if the cleaned names are similar (at least 70% match)
                    const similarity = calculateSimilarity(cleanedOrderName, cleanedMenuName);
                    if (similarity > 0.7 && similarity > (bestMatch ? calculateSimilarity(cleanedOrderName, bestMatch.toLowerCase().replace(/[^a-z]/g, '')) : 0)) {
                        bestMatch = itemName;
                        bestMatchPrice = purchasePrice;
                    }
                }
                
                if (bestMatch) {
                    console.log(`✅ Fuzzy match found: ${itemName} -> ${bestMatch} (₹${bestMatchPrice})`);
                    prices[itemName] = bestMatchPrice;
                } else {
                    console.log(`❌ No fuzzy match found for ${itemName}, using default 0`);
                    prices[itemName] = 0; // Default price
                }
            }
        });

        return prices;
    } catch (error: any) {
        console.error('Error fetching item prices:', error);
        // Return default prices for all items
        const defaultPrices: {[itemName: string]: number} = {};
        itemNames.forEach(itemName => {
            defaultPrices[itemName] = 0;
        });
        return defaultPrices;
    }
};

/**
 * Get orders from the Butcher POS sheet for a specific butcher
 */
export const getOrdersFromSheet = async (butcherId: string): Promise<Order[]> => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const butcherConfig = getButcherConfig(butcherId);
        const tabName = butcherConfig?.orderSheetTab;
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Get data from the specific butcher's tab
        // Columns: Order Date | Order No | Items | Quantity | Size | Cut type | Preparing weight | Completion Time | Start time | Status | Revenue
        const range = `${tabName}!A2:K`;
        const response = await measureApiCall(
            `getOrders:${butcherId}`,
            'GET',
            () => sheets.spreadsheets.values.get({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range,
            }),
            { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
        );

        const rows = response.data.values || [];
        const orders: Order[] = [];

        for (const row of rows) {
            // Determine butcher type for column structure
            const isMeat = isMeatButcher(butcherId);
            
            let orderDate, orderNo, items, quantity, size, cutType, preparingWeight, completionTime, startTime, statusFromSheet, revenueFromSheet;
            
            // Updated structure with Size column: 11 columns total
            [orderDate, orderNo, items, quantity, size, cutType, preparingWeight, completionTime, startTime, statusFromSheet, revenueFromSheet] = row;
            
            if (!orderNo) continue; // Skip empty rows

            // Parse items, quantities, and sizes
            const itemNames = parseArrayFromSheet(items || '');
            const quantities = parseArrayFromSheet(quantity || '');
            const sizes = parseArrayFromSheet(size || '');
            const cutTypes = parseArrayFromSheet(cutType || '');
            
            let preparingWeights: string[] = [];
            const preparingWeightsMap: { [itemName: string]: string } = {}; // Map item name to weight
            const rejectedItemNames = new Set<string>(); // Track rejected items
            
            // Parse preparing weight column
            // New format: "item: weight" or "item: rejected" (colon format, no curly braces)
            // Old format: "1.5kg, 500g" (comma-separated weights) - for backward compatibility
            if (preparingWeight && preparingWeight.trim()) {
                const weightStr = preparingWeight.trim();
                
                // Check if it's new colon format (contains ": " and item names)
                if (weightStr.includes(': ') && weightStr.match(/[a-zA-Z]/)) {
                    // Parse new format: "item: weight" or "item: rejected"
                    const weightParts = weightStr.split(',').map((p: string) => p.trim()).filter((p: string) => p);
                    
                    weightParts.forEach((part: string) => {
                        if (part.includes(': ')) {
                            const colonIndex = part.indexOf(': ');
                            const itemName = part.substring(0, colonIndex).trim();
                            const value = part.substring(colonIndex + 2).trim();
                            
                            if (value.toLowerCase() === 'rejected') {
                                // Item is rejected
                                rejectedItemNames.add(itemName);
                            } else {
                                // Item is accepted with weight - store in map
                                preparingWeightsMap[itemName] = value;
                            }
                        }
                    });
                    
                    // Map weights to items by name (maintain order of itemNames array)
                    itemNames.forEach((itemName, index) => {
                        if (preparingWeightsMap[itemName]) {
                            preparingWeights[index] = preparingWeightsMap[itemName];
                        } else if (!rejectedItemNames.has(itemName)) {
                            // Item not in map and not rejected - use original quantity as fallback
                            preparingWeights[index] = quantities[index] || quantities[0] || '';
                        }
                    });
                    
                    // Fallback for meat butchers if no accepted items found
                    if (preparingWeights.length === 0 && isMeat) {
                preparingWeights = quantities;
                }
            } else {
                    // Old format: Comma-separated weights (for backward compatibility)
                    preparingWeights = parseArrayFromSheet(preparingWeight);
                }
            }
            
            // Fallback for meat butchers if still no weights found
            if (isMeat && (preparingWeights.length === 0 || preparingWeights.every(w => !w || w.trim() === ''))) {
                preparingWeights = quantities;
            }

            // Create order items
            const orderItems: OrderItem[] = itemNames.map((itemName, index) => {
                const qty = quantities[index] || quantities[0] || '1';
                const itemSize = sizes[index] || sizes[0] || '';
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
                if (isFishButcher(butcherId)) {
                    // Check if the item name already has three languages (contains ' - ')
                    if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
                        // Already has three-language format, use as is
                        displayName = itemName;
                    } else {
                        // Only has English name, convert to three-language name
                        displayName = getFishItemFullName(itemName);
                    }
                }

                const orderItem: OrderItem = {
                    id: `${orderNo}-${index}`,
                    name: displayName,
                    quantity: parsedQty,
                    unit,
                    cutType: cut || undefined,
                    size: itemSize || undefined
                };
                
                // Mark item as rejected if found in rejectedItemNames
                if (rejectedItemNames.has(itemName)) {
                    (orderItem as any).rejected = 'Item rejected';
                }

                return orderItem;
            });

            // Determine order status based on sheet status or fallback to data analysis
            let status: Order['status'] = 'new';
            let prepStartTime: Date | undefined;
            let prepEndTime: Date | undefined;
            let pickedWeight: number | undefined;
            let finalWt: number | undefined;
            let revenue: number | undefined;
            let itemRevenues: { [itemName: string]: number } | undefined;

            // Map sheet status to internal status
            // Supports both old format (simple status) and new format (item-wise status)
            let rejectionReason: string | undefined;
            if (statusFromSheet && statusFromSheet.trim()) {
                const sheetStatus = statusFromSheet.toLowerCase().trim();
                
                // Check if it's item-wise format (contains " - accepted" or " - rejected")
                if (sheetStatus.includes(' - accepted') || sheetStatus.includes(' - rejected')) {
                    // Parse item-wise status: "chicken leg - accepted, beef steak - rejected"
                    const statusParts = sheetStatus.split(',').map((s: string) => s.trim()).filter((s: string) => s);
                    const hasAccepted = statusParts.some((part: string) => part.includes(' - accepted'));
                    const hasRejected = statusParts.some((part: string) => part.includes(' - rejected'));
                    const allRejected = statusParts.length > 0 && statusParts.every((part: string) => part.includes(' - rejected'));
                    
                    // Determine overall status
                    if (allRejected) {
                        status = 'rejected';
                        // Extract rejection reasons
                        const rejectionParts = statusParts
                            .filter((part: string) => part.includes(' - rejected'))
                            .map((part: string) => {
                                // Match: "item name - rejected - reason" or "item name - rejected"
                                const match = part.match(/ - rejected(?: - (.+))?$/);
                                return match && match[1] ? match[1].trim() : '';
                            })
                            .filter((r: string) => r);
                        rejectionReason = rejectionParts.join('; ') || 'Order rejected';
                    } else if (hasAccepted) {
                        // At least one item accepted
                        if (completionTime && completionTime.trim()) {
                            status = 'completed';
                        } else {
                            status = 'preparing';
                        }
                    } else {
                        status = 'new';
                    }
                } else {
                    // Old format: Simple status string
                switch (sheetStatus) {
                    case 'new':
                        status = 'new';
                        break;
                    case 'accepted':
                    case 'preparing':
                        status = 'preparing';
                        break;
                    case 'ready to pick up':
                        status = 'completed';
                        break;
                    case 'completed':
                        status = 'completed';
                        break;
                    case 'rejected':
                    case 'declined':
                        status = 'rejected';
                        break;
                    default:
                        // Check if the status starts with "REJECTED:" prefix
                        if (sheetStatus.startsWith('rejected:')) {
                            status = 'rejected';
                            rejectionReason = statusFromSheet.substring(9).trim(); // Remove "REJECTED:" prefix
                        } else if (sheetStatus !== 'new' && sheetStatus !== 'accepted' && sheetStatus !== 'preparing' && 
                            sheetStatus !== 'ready to pick up' && sheetStatus !== 'completed' && 
                            sheetStatus !== 'rejected' && sheetStatus !== 'declined') {
                            // This is likely a rejection reason (legacy format), treat as rejected
                            status = 'rejected';
                            rejectionReason = statusFromSheet; // Store the original rejection reason
                        } else {
                        // Fallback to data-based detection
                        if (preparingWeight && preparingWeight.trim()) {
                            status = 'completed';
                        } else {
                            status = 'new';
                                }
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
                // Parse preparation start time from sheet, or use current time as fallback
                prepStartTime = startTime && startTime.trim() ? new Date(startTime) : new Date();
                pickedWeight = preparingWeights.length > 0 ? preparingWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0) : undefined;
            }

            if (status === 'completed') {
                // Calculate preparation end time from completion time in sheet
                if (completionTime && completionTime.trim() && prepStartTime) {
                    // Parse completion time (format: "X min" or just "X")
                    const completionMinutes = parseFloat(completionTime.replace(/[^\d.]/g, ''));
                    if (!isNaN(completionMinutes)) {
                        prepEndTime = new Date(prepStartTime.getTime() + (completionMinutes * 60 * 1000));
                        console.log(`Order ${orderNo}: Using completion time from sheet: ${completionTime} -> ${completionMinutes} minutes -> end time: ${prepEndTime}`);
                    } else {
                        prepEndTime = new Date(); // Fallback to current time
                        console.log(`Order ${orderNo}: Invalid completion time format: "${completionTime}", using current time`);
                    }
                } else {
                    prepEndTime = new Date(); // Fallback to current time
                    console.log(`Order ${orderNo}: No completion time in sheet, using current time`);
                }
                
                // Read actual revenue from sheet instead of calculating with default rate
                if (revenueFromSheet && revenueFromSheet.trim()) {
                    // Parse revenue from sheet
                    // New format: "item: revenue, item: revenue" (colon format, no curly braces)
                    // Old format: "150.50, 200.00" (comma-separated numbers) - for backward compatibility
                    const revenueStr = revenueFromSheet.trim();
                    
                    let revenueValues: number[] = [];
                    const parsedItemRevenues: { [itemName: string]: number } = {};
                    
                    if (revenueStr.includes(': ')) {
                        // New format: "item: revenue, item: revenue"
                        const revenueParts = revenueStr.split(',').map((p: string) => p.trim()).filter((p: string) => p);
                        revenueParts.forEach((part: string) => {
                            // Extract item name and revenue from "item: revenue"
                            const colonIndex = part.indexOf(': ');
                            if (colonIndex > 0) {
                                const itemName = part.substring(0, colonIndex).trim();
                                const revenueValue = parseFloat(part.substring(colonIndex + 2).trim()) || 0;
                                if (revenueValue > 0) {
                                    parsedItemRevenues[itemName] = revenueValue;
                                    revenueValues.push(revenueValue);
                                }
                            }
                        });
                    } else {
                        // Old format: Comma-separated numbers
                        revenueValues = parseArrayFromSheet(revenueFromSheet)
                            .map((rev: string) => parseFloat(rev) || 0)
                            .filter((rev: number) => rev > 0);
                    }
                    
                    if (revenueValues.length > 0) {
                        // Sum up all revenue values if there are multiple items
                        revenue = revenueValues.reduce((sum, rev) => sum + rev, 0);
                        
                        // Store itemRevenues if parsed
                        if (Object.keys(parsedItemRevenues).length > 0) {
                            itemRevenues = parsedItemRevenues;
                        }
                    }
                } else if (preparingWeights.length > 0) {
                    // Fallback: Calculate revenue using preparing weight with default rate
                    const totalPreparingWeight = preparingWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
                    revenue = totalPreparingWeight * 0; // Default rate fallback
                }
            } else if (status === 'rejected') {
                // For rejected orders, read revenue from sheet if available
                if (revenueFromSheet && revenueFromSheet.trim()) {
                    // Parse revenue from sheet (could be comma-separated for multiple items)
                    const revenueValues = parseArrayFromSheet(revenueFromSheet);
                    if (revenueValues.length > 0) {
                        // Sum up all revenue values if there are multiple items
                        revenue = revenueValues.reduce((sum, rev) => sum + (parseFloat(rev) || 0), 0);
                    }
                } else {
                    // For rejected orders without revenue in sheet, calculate potential revenue based on quantities
                    const totalQuantity = quantities.reduce((sum, q) => sum + (parseFloat(q) || 0), 0);
                    revenue = totalQuantity * 0; // Default rate for potential revenue
                    console.log(`Order ${orderNo}: No revenue in sheet for rejected order, calculating potential revenue: ${totalQuantity} * 0 = ${revenue}`);
                }
            }

            // Add category information to order items based on butcher type and item patterns
            const itemsWithCategory = orderItems.map(item => {
                let category = '';
                
                if (isMeat) {
                    // Meat butchers - determine category based on item name patterns
                    const itemName = item.name.toLowerCase();
                    if (itemName.includes('chicken') || itemName.includes('breast') || itemName.includes('leg') || itemName.includes('wing')) {
                        category = 'chicken';
                    } else if (itemName.includes('mutton') || itemName.includes('lamb')) {
                        category = 'mutton';
                    } else if (itemName.includes('beef') || itemName.includes('liver')) {
                        category = 'beef';
                    } else {
                        category = 'meat'; // Default for meat butchers
                    }
                } else {
                    // Fish butchers - determine category based on item name patterns
                    const itemName = item.name.toLowerCase();
                    if (itemName.includes('ayakoora') || itemName.includes('king fish') || itemName.includes('seawater')) {
                        category = 'seawater fish';
                    } else if (itemName.includes('freshwater') || itemName.includes('pond')) {
                        category = 'freshwater fish';
                    } else {
                        category = 'fish'; // Default for fish butchers
                    }
                }
                
                return {
                    ...item,
                    category
                };
            });

            // Parse the order date from the sheet
            let orderTime: Date;
            if (orderDate && orderDate.trim()) {
                // Parse date in DD/MM/YYYY format
                const [day, month, year] = orderDate.split('/');
                if (day && month && year) {
                    // Create date with proper timezone handling
                    orderTime = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0, 0);
                    console.log(`Parsed date: ${orderDate} -> ${orderTime.toISOString()}`);
                } else {
                    console.warn(`Invalid date format: ${orderDate}, using current date`);
                    orderTime = new Date();
                }
            } else {
                // Fallback to current time if no date
                console.warn(`No date found for order ${orderNo}, using current date`);
                orderTime = new Date();
            }

            // Create unique order ID using date and order number
            const dateStr = orderTime.toISOString().split('T')[0]; // YYYY-MM-DD format
            const uniqueOrderId = `${dateStr}-${orderNo}`;

            console.log(`Creating order: ${orderNo} for date ${orderDate} -> ID: ORD-${uniqueOrderId}`);

            // Create custom weights objects for the order
            const itemQuantities: {[itemName: string]: string} = {};
            const itemWeights: {[itemName: string]: string} = {};
            
            if (isMeat) {
                // For meat butchers, store custom weights in itemQuantities
                itemsWithCategory.forEach((item, index) => {
                    if (preparingWeights[index]) {
                        itemQuantities[item.name] = preparingWeights[index];
                    }
                });
                console.log(`Meat butcher - itemQuantities:`, itemQuantities);
            } else {
                // For fish butchers, store custom weights in itemWeights
                itemsWithCategory.forEach((item, index) => {
                    if (preparingWeights[index]) {
                        itemWeights[item.name] = preparingWeights[index];
                    }
                });
                console.log(`Fish butcher - itemWeights:`, itemWeights);
                console.log(`Fish butcher - preparingWeights from sheet:`, preparingWeights);
                console.log(`Fish butcher - itemsWithCategory:`, itemsWithCategory.map(item => item.name));
                console.log(`Fish butcher - itemWeights mapping:`, itemWeights ? Object.entries(itemWeights) : 'none');
            }

            const order: Order = {
                id: `ORD-${uniqueOrderId}`,
                customerName: `Customer ${orderNo}`,
                items: itemsWithCategory,
                status,
                orderTime: orderTime, // Use parsed date from sheet
                preparationStartTime: prepStartTime,
                preparationEndTime: prepEndTime,
                pickedWeight,
                revenue,
                rejectionReason,
                // Add custom weights based on butcher type
                ...(isMeat ? { itemQuantities } : { itemWeights }),
                // Add itemRevenues if parsed from sheet
                ...(itemRevenues ? { itemRevenues } : {})
            };

            // Add individual weights/quantities based on butcher type
            if (preparingWeights.length > 0 && itemNames.length > 0) {
                if (isMeat) {
                    // Meat butchers: Store quantities for revenue calculation
                    const itemQuantities: {[itemName: string]: string} = {};
                    itemsWithCategory.forEach((item, index) => {
                        if (preparingWeights[index]) {
                            itemQuantities[item.name] = preparingWeights[index];
                        }
                    });
                    order.itemQuantities = itemQuantities;
                } else {
                    // Fish butchers: Store individual weights
                    const itemWeights: {[itemName: string]: string} = {};
                    itemsWithCategory.forEach((item, index) => {
                        if (preparingWeights[index]) {
                            itemWeights[item.name] = preparingWeights[index];
                        }
                    });
                    order.itemWeights = itemWeights;
                }
            }

            orders.push(order);
        }

        return orders.sort((a, b) => b.orderTime.getTime() - a.orderTime.getTime());

    } catch (error: any) {
        console.error('Error fetching orders from sheet:', error);
        throw new Error(`Failed to fetch orders: ${error.message}`);
    }
};

/**
 * Save a new order to the Butcher POS sheet
 */
export const saveOrderToSheet = async (order: Order, butcherId: string) => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const butcherConfig = getButcherConfig(butcherId);
        const tabName = butcherConfig?.orderSheetTab;
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Extract order number from order ID (ORD-2024-01-15-123 -> 123, ORD-143 -> 143)
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10); // Get the last part as number
        
        // Order Date: Always use today's date in IST
        const orderDate = getISTDate();
        
        // Format data for sheet
        const items = formatArrayForSheet(order.items.map(item => item.name));
        const quantities = formatArrayForSheet(order.items.map(item => `${item.quantity}${item.unit}`));
        const sizes = formatArrayForSheet(order.items.map(item => item.size || ''));
        const cutTypes = formatArrayForSheet(order.items.map(item => item.cutType || ''));
        
        // Determine butcher type for column structure
        const isMeat = isMeatButcher(butcherId);
        
        // Different column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const rowData = [
            orderDate, // Order Date (use actual order date)
            orderNo,
            items,
            quantities,
            sizes, // Size column (new)
            cutTypes,
            '', // preparing weight (empty initially)
            '', // completion time (empty initially)
            '', // start time (empty initially)
            'New', // status (starts as 'New')
            '' // revenue (empty initially)
        ];

        // Append to the specific tab
        await measureApiCall(
            `saveOrder:${butcherId}`,
            'POST',
            () => sheets.spreadsheets.values.append({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range: `${tabName}!A:K`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [rowData]
                }
            }),
            { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
        );

    } catch (error: any) {
        console.error('Error saving order to sheet:', error);
        throw new Error(`Failed to save order: ${error.message}`);
    }
};

/**
 * Save order to sheet after accepting (with item-wise status)
 * Used when order response is sent to Central API
 * Returns the calculated revenue for cache update
 */
export const saveOrderToSheetAfterAccept = async (order: Order, butcherId: string): Promise<{
  totalRevenue: number;
  itemRevenues: { [itemName: string]: number };
}> => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const butcherConfig = getButcherConfig(butcherId);
        const tabName = butcherConfig?.orderSheetTab;
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Extract order number from order ID (ORD-2024-01-15-123 -> 123, ORD-143 -> 143)
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10); // Get the last part as number
        
        // Order Date: Always use today's date in IST
        const orderDate = getISTDate();

        // Format item-wise data (comma-separated)
        const itemNames = order.items.map(item => item.name).join(', ');
        const quantities = order.items.map(item => `${item.quantity}${item.unit}`).join(', ');
        const sizes = order.items.map(item => item.size || '').join(', ');
        const cutTypes = order.items.map(item => item.cutType || '').join(', ');

        // Preparing weights: Format as item: weight or item: rejected (no curly braces)
        const preparingWeights = order.items.map(item => {
            const preparingWeight = (item as any).preparingWeight;
            const rejected = (item as any).rejected;
            
            if (rejected) {
                return `${item.name}: rejected`;
            } else if (preparingWeight) {
                return `${item.name}: ${preparingWeight}`;
            }
            return '';
        }).filter(w => w).join(', ');

        // Calculate revenue using preparing weights (or fall back to original weights)
        const { totalRevenue, itemRevenues } = await calculateRevenueFromPreparingWeights(order, butcherId);

        // Status: Only "completed" or "rejected"
        const allItemsRejected = order.items.every(item => (item as any).rejected);
        const sheetStatus = allItemsRejected ? 'rejected' : 'completed';

        // Start Time: IST format, human-readable (when order was accepted)
        const startTime = order.preparationStartTime ? getISTDateTime(order.preparationStartTime) : getISTDateTime(new Date());

        // Revenue: Format as item: revenue for multiple items, comma-separated (no curly braces)
        let revenueForSheet = '';
        if (itemRevenues && Object.keys(itemRevenues).length > 0) {
            const revenueParts = Object.entries(itemRevenues)
                .filter(([itemName, revenue]) => revenue > 0)
                .map(([itemName, revenue]) => `${itemName}: ${revenue.toFixed(2)}`);
            revenueForSheet = revenueParts.join(', ');
        } else if (totalRevenue > 0) {
            revenueForSheet = totalRevenue.toFixed(2);
        } else {
            // For rejected orders, revenue is 0
            revenueForSheet = '0.00';
        }

        const rowData = [
            orderDate,
            orderNo,
            itemNames,
            quantities,
            sizes,
            cutTypes,
            preparingWeights, // Format: item: weight or item: rejected (no curly braces)
            '', // completion time (empty initially, will be set when order is completed)
            startTime, // start time in IST format
            sheetStatus, // Only "completed" or "rejected"
            revenueForSheet // Format: item: revenue, item: revenue (no curly braces)
        ];

        // Append to the specific tab
        await measureApiCall(
            `saveOrderAfterAccept:${butcherId}`,
            'POST',
            () => sheets.spreadsheets.values.append({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range: `${tabName}!A:K`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [rowData]
                }
            }),
            { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
        );

        console.log(`[Order] Saved to Butcher POS sheet: Order ${orderNo}`);

        return { totalRevenue, itemRevenues };

    } catch (error: any) {
        console.error('Error saving order to sheet after accept:', error);
        throw new Error(`Failed to save order: ${error.message}`);
    }
};

/**
 * Update order status in the Butcher POS sheet
 */
export const updateOrderInSheet = async (order: Order, butcherId: string) => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const butcherConfig = getButcherConfig(butcherId);
        const tabName = butcherConfig?.orderSheetTab;
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Extract order number from order ID (ORD-2024-01-15-123 -> 123, ORD-143 -> 143)
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10); // Get the last part as number
        
        // Order Date: Always use today's date in IST
        const orderDate = getISTDate();
        
        // Determine butcher type for column structure
        const isMeat = isMeatButcher(butcherId);
        
        // Different column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const range = isMeat ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const response = await measureApiCall(
            `findOrder:${butcherId}`,
            'GET',
            () => sheets.spreadsheets.values.get({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range,
            }),
            { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
        );

        const rows = response.data.values || [];
        let rowIndex = -1;
        
        const orderNoStr = String(orderNo);
        // CRITICAL FIX: Range A2:G means rows start from sheet row 2
        // rows[0] = sheet row 2, rows[1] = sheet row 3, etc.
        // So rowIndex = i + 2 (not i + 1)
        for (let i = 0; i < rows.length; i++) { // Start from 0 since range already starts at row 2
            const rowDate = rows[i][0]; // Order Date is in column A (index 0)
            const rowOrderNo = rows[i][1]; // Order No is in column B (index 1)
            
            // Convert both to strings for comparison (sheet values are strings)
            const rowOrderNoStr = String(rowOrderNo || '').trim();
            
            // Match both date and order number to ensure uniqueness
            if (rowDate === orderDate && rowOrderNoStr === orderNoStr) {
                rowIndex = i + 2; // Range starts at row 2, so add 2 (not 1)
                break;
            }
        }

        if (rowIndex === -1) {
            // Try alternative date formats based on order.orderTime
            const orderTimeDate = new Date(order.orderTime);
            const alternativeDates = [
                orderTimeDate.toLocaleDateString('en-US'), // US format: MM/DD/YYYY
                orderTimeDate.toLocaleDateString('en-CA'), // Canadian format: YYYY-MM-DD
                orderTimeDate.toISOString().split('T')[0], // ISO format: YYYY-MM-DD
                orderDate, // Already tried format (en-GB)
            ];
            
            for (let altDate of alternativeDates) {
                const orderNoStr = String(orderNo);
                // CRITICAL FIX: Range A2:G means rows start from sheet row 2
                // rows[0] = sheet row 2, rows[1] = sheet row 3, etc.
                for (let i = 0; i < rows.length; i++) {
                    const rowDate = rows[i][0];
                    const rowOrderNo = rows[i][1];
                    const rowOrderNoStr = String(rowOrderNo || '').trim();
                    
                    if (rowDate === altDate && rowOrderNoStr === orderNoStr) {
                        rowIndex = i + 2; // Range starts at row 2, so add 2 (not 1)
                        break;
                    }
                }
                if (rowIndex !== -1) break;
            }
        }
        
        if (rowIndex === -1) {
            // CRITICAL: Never create duplicate rows for completed/prepared orders
            // These orders MUST already exist in the sheet from when they were accepted
            if (order.status === 'completed' || order.status === 'prepared' || order.status === 'ready to pick up') {
                console.warn(`[Order] Cannot find order ${orderNo} in sheet for completion. Order should have been saved when accepted. Skipping update to prevent duplicate.`);
                return; // Exit early - don't create duplicate
            }
            
            // Only create new orders if they're truly new (status is 'new' or 'preparing' without accepted data)
            // But NEVER create if order has revenue (means it was already accepted and should exist)
            const hasRevenue = (order.revenue && order.revenue > 0) || 
                              (order.itemRevenues && Object.keys(order.itemRevenues).length > 0);
            
            if (hasRevenue) {
                // Order has revenue, meaning it was already accepted and should exist in sheet
                // Don't create duplicate - just return
                console.warn(`[Order] Cannot find order ${orderNo} in sheet but order has revenue. Order should already exist. Skipping update to prevent duplicate.`);
                return;
            }
            
            try {
                // Check if order has been accepted (has weights, or item data)
                const hasOrderData = (order.itemWeights && Object.keys(order.itemWeights).length > 0) ||
                                   (order.itemQuantities && Object.keys(order.itemQuantities).length > 0) ||
                                   order.items.some(item => (item as any).preparingWeight || (item as any).rejected);
                
                if (hasOrderData && (order.status === 'preparing' || order.status === 'new')) {
                    // Order has been accepted/prepared - use saveOrderToSheetAfterAccept
                    await saveOrderToSheetAfterAccept(order, butcherId);
                } else if (order.status === 'new' || order.status === 'preparing') {
                    // New order without data - use saveOrderToSheet
                    await saveOrderToSheet(order, butcherId);
                } else {
                    // For other statuses, don't create - just return
                    return; // Exit early - don't create
                }
                
                // Now try to find it again
                const newResponse = await measureApiCall(
                    `findOrderAfterSave:${butcherId}`,
                    'GET',
                    () => sheets.spreadsheets.values.get({
                        spreadsheetId: BUTCHER_POS_SHEET_ID,
                        range,
                    }),
                    { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
                );
                
                const newRows = newResponse.data.values || [];
                const orderNoStr = String(orderNo);
                // CRITICAL FIX: Range A2:G means rows start from sheet row 2
                // rows[0] = sheet row 2, rows[1] = sheet row 3, etc.
                for (let i = 0; i < newRows.length; i++) {
                    const rowDate = newRows[i][0];
                    const rowOrderNo = newRows[i][1];
                    const rowOrderNoStr = String(rowOrderNo || '').trim();
                    
                    if (rowDate === orderDate && rowOrderNoStr === orderNoStr) {
                        rowIndex = i + 2; // Range starts at row 2, so add 2 (not 1)
                        break;
                    }
                }
                
                if (rowIndex === -1) {
                    return; // Exit early - don't throw error, just skip update
                }
            } catch (saveError) {
                console.error(`[Order] Failed to save order before updating:`, saveError);
                return;
            }
        }

        // Prepare update data based on butcher type
        // Format preparing weight: item: weight or item: rejected (no curly braces)
        let preparingWeight = '';
        
        // Build preparing weight string in format: item: weight or item: rejected (no curly braces)
        // Preparing weights are keyed by item.name in order.itemWeights (fish) or order.itemQuantities (meat)
        // Values are already formatted with units (e.g., "2.1kg") from the dashboard dialog
        const preparingWeightParts: string[] = [];
        order.items.forEach(item => {
            const rejected = (item as any).rejected;
            if (rejected) {
                // Item rejected: item: rejected
                preparingWeightParts.push(`${item.name}: rejected`);
            } else {
                // Item accepted: get preparing weight from multiple sources
                // Priority 1: order.itemWeights/itemQuantities (set when marked as prepared)
                // Priority 2: item.preparingWeight (set when order was accepted)
                // Priority 3: original item.quantity (fallback)
                let weight = '';
                if (isMeat) {
                    weight = order.itemQuantities?.[item.name] || '';
                } else {
                    weight = order.itemWeights?.[item.name] || '';
                }
                
                // Fallback to item.preparingWeight if not found in order.itemWeights/itemQuantities
                // This handles orders that were accepted but itemWeights/itemQuantities weren't set
                if (!weight) {
                    weight = (item as any).preparingWeight || '';
                }
                
                // If still no weight, use original quantity with unit (shouldn't happen for prepared orders)
                if (!weight) {
                    weight = `${item.quantity}${item.unit}`;
                }
                
                if (weight) {
                    // Weight already includes unit from dashboard (e.g., "2.1kg" or "2.65kg"), use as is
                    preparingWeightParts.push(`${item.name}: ${weight}`);
                }
            }
        });
        preparingWeight = preparingWeightParts.join(', ');
            
        // Completion Time: 
        // - For preparing orders: Show elapsed minutes countdown (e.g., "5min")
        // - For completed orders: Time taken if within 20min, or actual IST time if exceeded
        let completionTime = '';
        if (order.status === 'preparing' || order.status === 'prepared') {
            // Order is still preparing - calculate elapsed time from start to now
            if (order.preparationStartTime) {
                const now = new Date();
                const start = order.preparationStartTime instanceof Date 
                    ? order.preparationStartTime 
                    : new Date(order.preparationStartTime);
                const diffMs = now.getTime() - start.getTime();
                const diffMinutes = Math.floor(diffMs / (1000 * 60));
                // Show elapsed minutes (countdown) for preparing orders
                completionTime = `${diffMinutes}min`;
            }
        } else {
            // Order is completed - use normal completion time calculation
            completionTime = getCompletionTime(order.preparationStartTime, order.preparationEndTime);
        }
        
        // Start Time: IST format, human-readable (when order was accepted)
        const startTime = order.preparationStartTime ? getISTDateTime(order.preparationStartTime) : '';
        
        // Status: Only "completed" or "rejected"
        // - "completed" if any items completed (partial or full)
        // - "rejected" only if entire order is rejected
        let sheetStatus = '';
        const allItemsRejected = order.items.every(item => (item as any).rejected);
        const hasAcceptedItems = order.items.some(item => !(item as any).rejected);
        
        if (order.status === 'rejected' || allItemsRejected) {
            sheetStatus = 'rejected';
        } else if (order.status === 'completed' || order.status === 'prepared' || hasAcceptedItems) {
            sheetStatus = 'completed';
                } else {
            // Default to completed if status is unclear
            sheetStatus = 'completed';
        }
        
        // Revenue: Format as item: revenue for multiple items, comma-separated (no curly braces)
        // Reuse calculated revenue from order.itemRevenues - no recalculation
        let revenueForSheet = '';
        if (order.itemRevenues && Object.keys(order.itemRevenues).length > 0) {
            // Format: item: revenue, item: revenue (no curly braces)
            const revenueParts = Object.entries(order.itemRevenues)
                .filter(([itemName, revenue]) => revenue > 0) // Only include items with revenue
                .map(([itemName, revenue]) => `${itemName}: ${revenue.toFixed(2)}`);
            revenueForSheet = revenueParts.join(', ');
        } else if (order.revenue && order.revenue > 0) {
            // Fallback: If only total revenue available, use total
            revenueForSheet = order.revenue.toFixed(2);
        } else {
            // No revenue calculated yet (should not happen for completed orders)
            revenueForSheet = '';
        }

        // Update the specific row - both meat and fish butchers have same column structure
        // columns G, H, I, J, K (preparing weight, completion time, start time, status, revenue)
        // Note: Size column is now at position 5 (F), so preparing weight moved to position 6 (G)
        const updateRange = `${tabName}!G${rowIndex}:K${rowIndex}`;
        const updateValues = [[preparingWeight, completionTime, startTime, sheetStatus, revenueForSheet]];
        
        const updateResponse = await measureApiCall(
            `updateOrder:${butcherId}`,
            'PUT',
            () => sheets.spreadsheets.values.update({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range: updateRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: updateValues
                }
            }),
            { sheetId: BUTCHER_POS_SHEET_ID, sheetName: 'Butcher POS Sheet' }
        );
        
        if (updateResponse.status !== 200) {
            throw new Error(`Google Sheets update failed with status ${updateResponse.status}`);
        }

    } catch (error: any) {
        console.error('Error updating order in sheet:', error);
        console.error('Error stack:', error.stack);
        console.error('Order data that caused error:', {
            id: order.id,
            status: order.status,
            butcherId: butcherId,
            revenue: order.revenue,
            itemRevenues: order.itemRevenues,
            itemWeights: order.itemWeights,
            itemQuantities: order.itemQuantities
        });
        
        // Provide more specific error messages
        if (error.message?.includes('not configured')) {
            throw new Error(`Google Sheets configuration error: ${error.message}`);
        } else if (error.message?.includes('not found')) {
            throw new Error(`Order not found in sheet: ${error.message}`);
        } else if (error.message?.includes('authentication') || error.message?.includes('credentials')) {
            throw new Error(`Google Sheets authentication error: ${error.message}`);
        } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
            throw new Error(`Google Sheets API quota exceeded. Please try again in a moment.`);
        } else {
            throw new Error(`Failed to update order in sheet: ${error.message || 'Unknown error'}`);
        }
    }
};

/**
 * Save menu items to the Menu POS sheet
 */
export const saveMenuToSheet = async (butcherId: string, menu: MenuCategory[]): Promise<void> => {
    try {
        if (!MENU_POS_SHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID_MENU_POS not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const butcherType = getButcherType(butcherId);
        
        // For mixed butchers, determine tab from first category
        // For meat/fish butchers, use BUTCHER_TABS
        let tabName: string | null = null;
        if (butcherType === 'mixed') {
            if (menu.length > 0) {
                const firstCategory = menu[0];
                tabName = getPriceSheetTab(butcherId, firstCategory.name);
            }
            if (!tabName) {
                throw new Error(`No tab found for mixed butcher: ${butcherId}`);
            }
        } else {
            tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS] || null;
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
            }
        }

        // Determine butcher type
        const isMeatButcher = butcherType === 'meat' || (butcherType === 'mixed' && menu.length > 0 && getItemTypeFromCategory(menu[0].name) === 'meat');
        const isFishButcher = butcherType === 'fish' || (butcherType === 'mixed' && menu.length > 0 && getItemTypeFromCategory(menu[0].name) === 'fish');
        
        // Clear existing data
        const clearRange = isMeatButcher ? `${tabName}!A2:G` : `${tabName}!A2:H`;
            await sheets.spreadsheets.values.clear({
                spreadsheetId: MENU_POS_SHEET_ID,
                range: clearRange,
            });

        // Prepare data
        const rows: any[][] = [];
        const currentDate = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format
        
        for (const category of menu) {
            for (const item of category.items) {
                if (!item.available) continue;
                
                for (const size of item.sizes) {
                    if (size.price <= 0) continue;

                    // Extract English name for fish items
                    let itemName = item.name;
                    if (item.name.includes(' - ') && item.name.split(' - ').length >= 3) {
                        const nameParts = item.name.split(' - ');
                        itemName = nameParts[1].trim(); // Extract English name
                    }
                    
                    // No longer adding "meat" suffix for fish butchers' steak fish items
                    // Fish butchers will use the original item names without suffix
                    
                    // Calculate selling price with markup based on category from butcherConfig
                    const categoryName = category.name;
                    const markupRate = getMarkupRate(butcherId, categoryName);
                    const sellingPrice = Math.round(size.price * (1 + markupRate));
                    
                    // Prepare row data
                    const row: any[] = [];
                    
                    if (isMeatButcher) {
                        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight | Date
                        row.push(
                            itemName,
                            category.name,
                            size.price,
                            sellingPrice,
                            item.unit,
                            size.minWeight && size.maxWeight ? `${size.minWeight}-${size.maxWeight}` : '',
                            currentDate
                        );
                    } else {
                        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight | Date
                        row.push(
                            itemName,
                            category.name,
                            size.size === 'default' ? '' : size.size,
                            size.price,
                            sellingPrice,
                            item.unit,
                            size.minWeight && size.maxWeight ? `${size.minWeight}-${size.maxWeight}` : '',
                            currentDate
                        );
                    }
                    
                    rows.push(row);
                }
            }
        }

        // Write to sheet
        if (rows.length > 0) {
            const range = isMeatButcher ? `${tabName}!A2:G` : `${tabName}!A2:H`;
            await sheets.spreadsheets.values.update({
                spreadsheetId: MENU_POS_SHEET_ID,
                range,
                valueInputOption: 'RAW',
                requestBody: {
                    values: rows
                }
            });
        }

        // Notify Central API about menu update (non-blocking)
        try {
            const { centralAPIClient } = await import('./centralAPIClient');
            const { getButcherNameFromId } = await import('./butcherMapping');
            const { queueMenuUpdate } = await import('./orderQueue');
            const { isMixedButcher, getItemTypeFromCategory } = await import('./butcherConfig');
            
            const butcherName = getButcherNameFromId(butcherId) || butcherId;
            
            // Determine menu type for mixed butchers
            let menuType: 'meat' | 'fish' | undefined = undefined;
            if (isMixedButcher(butcherId) && menu.length > 0) {
                const firstCategory = menu[0];
                const categoryType = getItemTypeFromCategory(firstCategory.name);
                if (categoryType === 'meat' || categoryType === 'fish') {
                    menuType = categoryType;
                }
            }
            
            // Attempt to notify Central API
            try {
                await centralAPIClient.notifyMenuUpdate(butcherId, butcherName, menuType);
                console.log(`[Menu] Updated: ${butcherName}${menuType ? ` (${menuType})` : ''}`);
            } catch (error: any) {
                // If notification fails, queue it for retry
                console.warn(`[Menu] Failed to notify Central API, queuing for retry:`, error.message);
                queueMenuUpdate(butcherId, butcherName, menuType);
            }
        } catch (error: any) {
            // Log but don't fail menu save if notification setup fails
            console.error('Error setting up menu update notification:', error);
        }

    } catch (error: any) {
        console.error('Error saving menu to sheet:', error);
        throw new Error(`Failed to save menu: ${error.message}`);
    }
};

/**
 * Get menu items from the Menu POS sheet for a specific butcher
 */
export const getMenuFromSheet = async (butcherId: string, tabNameOverride?: string | null): Promise<MenuCategory[]> => {
    try {
        if (!MENU_POS_SHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID_MENU_POS not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        
        // Use override tab name if provided (for mixed butchers), otherwise use BUTCHER_TABS
        let tabName: string | null = null;
        if (tabNameOverride) {
            tabName = tabNameOverride;
        } else {
            const butcherType = getButcherType(butcherId);
            if (butcherType === 'mixed') {
                // For mixed butchers without override, we can't determine which tab to use
                throw new Error(`Tab name required for mixed butcher: ${butcherId}`);
            }
            tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS] || null;
        }
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine butcher type
        const butcherType = getButcherType(butcherId);
        const isMeatButcher = butcherType === 'meat' || (butcherType === 'mixed' && tabName && getButcherConfig(butcherId)?.meatSheetTab === tabName);
        
        // Read data from sheet
        const range = isMeatButcher ? `${tabName}!A2:G` : `${tabName}!A2:H`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MENU_POS_SHEET_ID,
            range,
        });

        const rows = response.data.values || [];
        const categoriesMap: { [key: string]: MenuCategory } = {};

        for (const row of rows) {
            let itemName, categoryName, purchasePrice, sellingPrice, unit, nosWeight, size, date;
            
            if (isMeatButcher) {
                // Meat butchers: Item Name, Category, Purchase Price, Selling Price, Unit, nos weight, Date
                [itemName, categoryName, purchasePrice, sellingPrice, unit, nosWeight, date] = row;
                size = 'default';
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight, Date
                [itemName, categoryName, size, purchasePrice, sellingPrice, unit, nosWeight, date] = row;
                
                // Handle empty size for meat products
                if (!size && categoryName && categoryName.toLowerCase().includes('meat')) {
                    size = 'default';
                }
            }
            
            if (!itemName || !categoryName) continue;

            // Create category if it doesn't exist
            if (!categoriesMap[categoryName]) {
                categoriesMap[categoryName] = {
                    id: categoryName.toLowerCase().replace(/\s+/g, '-'),
                    name: categoryName,
                    items: []
                };
            }

            // Parse weight range
            let minWeight: number | undefined;
            let maxWeight: number | undefined;
            if (nosWeight && nosWeight.includes('-')) {
                const [min, max] = nosWeight.split('-');
                minWeight = parseFloat(min) || undefined;
                maxWeight = parseFloat(max) || undefined;
            }

            // Parse price
            const parsedPrice = parseFloat(purchasePrice) || 0;
            
            // Check if item already exists
            const existingItem = categoriesMap[categoryName].items.find(item => 
                item.name.toLowerCase() === itemName.toLowerCase()
            );
            
            if (existingItem) {
                // Add size to existing item
                existingItem.sizes.push({
                    id: `s-${Date.now()}-${Math.random()}`,
                    size: size as 'default' | 'small' | 'medium' | 'big',
                    price: parsedPrice,
                    minWeight,
                    maxWeight
                });
            } else {
                // Create new item
            const menuItem: MenuItem = {
                id: itemName.toLowerCase().replace(/\s+/g, '-'),
                name: itemName,
                unit: unit as 'kg' | 'nos',
                    available: parsedPrice > 0,
                sizes: [{
                    id: `s-${Date.now()}`,
                    size: size as 'default' | 'small' | 'medium' | 'big',
                    price: parsedPrice,
                    minWeight,
                    maxWeight
                }]
            };

            categoriesMap[categoryName].items.push(menuItem);
            }
        }

        const result = Object.values(categoriesMap);
        return result;

    } catch (error: any) {
        console.error('Error fetching menu from sheet:', error);
        throw new Error(`Failed to fetch menu: ${error.message}`);
    }
};

/**
 * Extract English name from full three-language name
 */
const extractEnglishName = (fullName: string): string => {
    if (fullName.includes(' - ') && fullName.split(' - ').length >= 3) {
        // Fish items: "Malayalam - English - Tamil" -> extract English name (middle part)
        const nameParts = fullName.split(' - ');
        return nameParts[1].trim();
    }
    // For other items, return as is
    return fullName;
};

/**
 * Merge menu data from sheet with the full menu structure
 * @param activeTab - For mixed butchers, specify 'meat' or 'fish' to determine which sheet tab to load from
 */
export const mergeMenuFromSheet = async (butcherId: string, fullMenu: MenuCategory[], activeTab?: 'meat' | 'fish'): Promise<MenuCategory[]> => {
    try {
        // For mixed butchers, determine which tab to load from
        const butcherType = getButcherType(butcherId);
        let tabName: string | null = null;
        if (butcherType === 'mixed') {
            if (activeTab) {
                // Use activeTab to determine which sheet tab to use
                const config = getButcherConfig(butcherId);
                if (config) {
                    tabName = activeTab === 'meat' ? config.meatSheetTab || null : config.fishSheetTab || null;
                }
            } else if (fullMenu.length > 0) {
                // Fallback: determine from first category
                tabName = getPriceSheetTab(butcherId, fullMenu[0].name);
            }
            
            if (!tabName) {
                throw new Error(`Could not determine sheet tab for mixed butcher ${butcherId}. Please specify activeTab parameter.`);
            }
        }
        const sheetMenu = await getMenuFromSheet(butcherId, tabName);
        
        // Create a simple lookup map
        const sheetDataMap: { [key: string]: { [size: string]: { price: number, minWeight?: number, maxWeight?: number } } } = {};
        
        for (const category of sheetMenu) {
            for (const item of category.items) {
                // Create lookup keys for the item name
                const keys = [
                    item.name,
                    item.name.toLowerCase(),
                    item.name.toUpperCase(),
                    normalizeItemName(item.name)
                ];
                
                for (const key of keys) {
                    if (!sheetDataMap[key]) {
                        sheetDataMap[key] = {};
                    }
                    
                for (const size of item.sizes) {
                        const sizeKey = size.size || 'default';
                        sheetDataMap[key][sizeKey] = {
                        price: size.price,
                        minWeight: size.minWeight,
                        maxWeight: size.maxWeight
                    };
                    }
                }
            }
        }

        // Merge with full menu
        const mergedMenu = fullMenu.map(category => ({
            ...category,
            items: category.items.map(item => {
                // Extract English name for fish items
                let searchName = item.name;
                
                if (item.name.includes(' - ') && item.name.split(' - ').length >= 3) {
                    const nameParts = item.name.split(' - ');
                    searchName = nameParts[1].trim(); // Extract English name
                }
                
                // Try to find sheet data
                let sheetItem = null;
                
                // No longer using "meat" suffix for fish butchers' meat items
                // Fish butchers will match items using original names
                
                // If no meat-specific match found, try general matching
                if (!sheetItem) {
                    sheetItem = sheetDataMap[searchName] || 
                               sheetDataMap[searchName.toLowerCase()] || 
                               sheetDataMap[searchName.toUpperCase()] ||
                               sheetDataMap[normalizeItemName(searchName)];
                }
                
                if (!sheetItem) {
                    return item; // No sheet data found
                }

                // Update sizes with sheet data
                const updatedSizes = item.sizes.map(size => {
                    const sheetSizeData = sheetItem[size.size];
                    if (sheetSizeData && sheetSizeData.price > 0) {
                        return {
                            ...size,
                            price: sheetSizeData.price,
                            minWeight: sheetSizeData.minWeight,
                            maxWeight: sheetSizeData.maxWeight
                        };
                    }
                    return size;
                });

                // Determine availability
                const hasAnyPrice = updatedSizes.some(size => size.price > 0);

                return {
                    ...item,
                    sizes: updatedSizes,
                    available: hasAnyPrice
                };
            })
        }));

        return mergedMenu;

    } catch (error: any) {
        console.error('Error merging menu from sheet:', error);
        throw new Error(`Failed to merge menu: ${error.message}`);
    }
};

/**
 * Get butcher earnings for order items based on menu prices
 */
export const getButcherEarnings = async (butcherId: string, orderItems: OrderItem[]): Promise<{ [itemName: string]: { purchasePrice: number; butcherEarnings: number; totalEarnings: number } }> => {
    try {
        // Direct Google Sheets call for earnings calculation

        if (!MENU_POS_SHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID_MENU_POS not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine if this is a meat butcher (no size column)
        const isMeatButcher = getButcherType(butcherId) === 'meat';
        
        // Different column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const range = isMeatButcher ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MENU_POS_SHEET_ID,
            range,
        });

        const rows = response.data.values || [];
        const menuPrices: { [itemName: string]: number } = {};

        // Build price lookup from menu sheet with size consideration
        console.log(`Building menu prices for ${butcherId} (${isMeatButcher ? 'meat' : 'fish'} butcher)`);
        console.log(`Found ${rows.length} rows in menu sheet`);
        
        for (const row of rows) {
            let itemName, size, purchasePrice;
            
            if (isMeatButcher) {
                // Meat butchers: Item Name, Category, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , purchasePrice] = row;
                size = 'default'; // Meat products don't have sizes
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , size, purchasePrice] = row;
            }
            if (itemName && purchasePrice) {
                const price = parseFloat(purchasePrice) || 0;
                const exactKey = itemName.trim(); // Keep exact case and spacing from sheet
                
                // Store base price with exact case and spacing
                menuPrices[exactKey] = price;
                console.log(`Added menu price: "${exactKey}" = ${price} (exact from sheet)`);
                
                // For fish butchers with sizes, also store with size key
                if (!isMeatButcher && size && size !== 'default') {
                    const keyWithSize = `${exactKey} (${size})`;
                    menuPrices[keyWithSize] = price;
                    console.log(`Added menu price with size: "${keyWithSize}" = ${price}`);
                }
            }
        }
        
        console.log(`Final menu prices for ${butcherId}:`, Object.keys(menuPrices));

        // Calculate earnings for each order item using dynamic commission rates
        const earnings: { [itemName: string]: { purchasePrice: number; butcherEarnings: number; totalEarnings: number } } = {};

        for (const item of orderItems) {
            // Use exact case-sensitive and space-sensitive matching
            const exactItemName = item.name; // Keep original case and spacing
            const itemSize = item.size || 'default';
            let purchasePrice = 0;

            // Fish butchers: Try size-specific matching first (case-sensitive and space-sensitive)
            if (!isMeatButcher && itemSize && itemSize !== 'default') {
                // Try exact match with size: "Mackerel Small"
                const keyWithSize = `${exactItemName} ${itemSize}`;
                if (menuPrices[keyWithSize]) {
                    purchasePrice = menuPrices[keyWithSize];
                    console.log(`✅ Found exact size-specific match: "${keyWithSize}" = ${purchasePrice}`);
                }
                
                // Try with parentheses: "Mackerel (Small)"
                if (purchasePrice === 0) {
                    const keyWithParentheses = `${exactItemName} (${itemSize})`;
                    if (menuPrices[keyWithParentheses]) {
                        purchasePrice = menuPrices[keyWithParentheses];
                        console.log(`✅ Found parentheses size match: "${keyWithParentheses}" = ${purchasePrice}`);
                    }
                }
                
                // Try case-insensitive size match
                if (purchasePrice === 0) {
                    const keyWithSizeLower = `${exactItemName.toLowerCase()} ${itemSize.toLowerCase()}`;
                const matchingKey = Object.keys(menuPrices).find(key => 
                        key.toLowerCase() === keyWithSizeLower
                );
                if (matchingKey) {
                    purchasePrice = menuPrices[matchingKey];
                        console.log(`✅ Found case-insensitive size match: "${matchingKey}" = ${purchasePrice}`);
                    }
                }
            }
            
            // If no size-specific match, try exact base name match (case-sensitive and space-sensitive)
            if (purchasePrice === 0 && menuPrices[exactItemName]) {
                purchasePrice = menuPrices[exactItemName];
                console.log(`✅ Found exact base name match: "${exactItemName}" = ${purchasePrice}`);
            }
            
            // If still no match, try case-insensitive but space-sensitive matching
            if (purchasePrice === 0) {
                console.log(`Trying case-insensitive matching for "${exactItemName}"...`);
                console.log(`Available keys for case-insensitive matching:`, Object.keys(menuPrices));
                const matchingKey = Object.keys(menuPrices).find(key => {
                    const isMatch = key.toLowerCase() === exactItemName.toLowerCase();
                    console.log(`  Checking "${key}" vs "${exactItemName}": ${isMatch}`);
                    return isMatch;
                });
                if (matchingKey) {
                    purchasePrice = menuPrices[matchingKey];
                    console.log(`✅ Found case-insensitive match: "${matchingKey}" = ${purchasePrice}`);
                } else {
                    console.log(`❌ No case-insensitive matches found for "${exactItemName}"`);
                    console.log(`Available menu prices:`, Object.keys(menuPrices));
                }
            }

            // If no price found, use default
            if (purchasePrice === 0) {
                console.warn(`⚠️ No purchase price found for ${item.name} (${exactItemName}) in ${butcherId} menu. Using default price 0.`);
                console.log(`Available menu prices for ${butcherId}:`, Object.keys(menuPrices));
                purchasePrice = 0; // Default price per kg
            }

            // Get commission rate for this item's category from butcherConfig
            const itemCategory = item.category || 'default';
            const commissionRate = getCommissionRate(butcherId, itemCategory);

            // Calculate butcher earnings: purchase price - commission
            const butcherPricePerUnit = purchasePrice - (purchasePrice * commissionRate);
            const totalEarnings = butcherPricePerUnit * item.quantity;

            earnings[item.name] = {
                purchasePrice,
                butcherEarnings: butcherPricePerUnit,
                totalEarnings
            };
        }

        // Earnings calculated and returned

        return earnings;

    } catch (error: any) {
        console.error('Error calculating butcher earnings:', error);
        // Return default earnings if there's an error
        const defaultEarnings: { [itemName: string]: { purchasePrice: number; butcherEarnings: number; totalEarnings: number } } = {};
        
        for (const item of orderItems) {
            const defaultPrice = 0;
            const itemCategory = item.category || 'default';
            const commissionRate = getCommissionRate(butcherId, itemCategory);
            const butcherPrice = defaultPrice - (defaultPrice * commissionRate);
            defaultEarnings[item.name] = {
                purchasePrice: defaultPrice,
                butcherEarnings: butcherPrice,
                totalEarnings: butcherPrice * item.quantity
            };
        }
        
        return defaultEarnings;
    }
};

// REMOVED: savePreparedOrderToSheet - unnecessary wrapper
// Use updateOrderInSheet directly for status updates

/**
 * Calculate revenue from order items using preparing weights
 * Uses preparing weights if available, otherwise falls back to original order weights
 */
const calculateRevenueFromPreparingWeights = async (
  order: Order,
  butcherId: string
): Promise<{ totalRevenue: number; itemRevenues: { [itemName: string]: number } }> => {
  let totalRevenue = 0;
  const itemRevenues: { [itemName: string]: number } = {};
  
  // Helper to parse weight string (e.g., "1.5kg" -> 1.5, "2nos" -> 2, "500g" -> 0.5)
  const parseWeightString = (weightStr: string, unit: string): number => {
    if (!weightStr) return 0;
    
    // Remove unit if present and extract numeric part
    const numericPart = weightStr.replace(/[^0-9.]/g, '');
    const weight = parseFloat(numericPart) || 0;
    
    // Convert grams to kg if needed
    if (weightStr.toLowerCase().includes('g') && !weightStr.toLowerCase().includes('kg')) {
      return weight / 1000; // Convert grams to kg
    }
    
    return weight;
  };
  
  for (const item of order.items) {
    const itemName = item.name;
    const itemSize = item.size || 'default'; // Get size from order item, default to 'default' if not present
    const itemKey = `${itemName}_${itemSize}`; // Use itemName_size as key for revenue tracking
    const rejected = (item as any).rejected;
    
    // Skip rejected items (no revenue)
    if (rejected) {
      itemRevenues[itemKey] = 0;
      continue;
    }
    
    // Get preparing weight from item, or fall back to original quantity
    const preparingWeightStr = (item as any).preparingWeight;
    let weight = 0;
    
    if (preparingWeightStr) {
      // Use preparing weight entered by butcher
      weight = parseWeightString(preparingWeightStr, item.unit);
    } else {
      // Fall back to original order quantity
      weight = item.quantity;
    }
    
    if (weight <= 0) {
      itemRevenues[itemKey] = 0;
      continue;
    }
    
    try {
      // Get purchase price and category from menu (pass size parameter)
      const { price: purchasePrice, category: menuCategory } = await getPurchasePriceFromMenu(butcherId, itemName, itemSize);
      // Use category from menu (found when looking up price) instead of item.category
      const category = menuCategory || item.category || 'default';
      // Get commission rate from butcherConfig (no need for custom rates parameter)
      const commissionRate = getCommissionRate(butcherId, category);
      
      // Debug logging for revenue calculation
      console.log(`[calculateRevenueFromPreparingWeights] Revenue calculation for ${itemName}:`, {
        butcherId,
        itemName,
        itemSize,
        category: category,
        purchasePrice,
        commissionRate: `${(commissionRate * 100).toFixed(1)}%`,
        weight,
        calculation: `(${purchasePrice} × ${weight}) - (${(commissionRate * 100).toFixed(1)}% × ${purchasePrice} × ${weight})`,
        itemRevenue: (purchasePrice * weight) - (commissionRate * purchasePrice * weight)
      });
      
      // Calculate item revenue: (Purchase Price × Weight) - Commission% of (Purchase Price × Weight)
      const itemRevenue = (purchasePrice * weight) - (commissionRate * purchasePrice * weight);
      
      itemRevenues[itemKey] = itemRevenue;
      totalRevenue += itemRevenue;
    } catch (error) {
      console.error(`[Order] Error calculating revenue for ${itemName} (${itemSize}):`, error);
      itemRevenues[itemKey] = 0;
    }
  }
  
  return { totalRevenue, itemRevenues };
};

/**
 * Centralized revenue calculation for completed orders
 * This ensures revenue is calculated once and stored consistently
 */
export const calculateOrderRevenue = async (order: Order, butcherId: string): Promise<{
  totalRevenue: number;
  itemRevenues: { [itemName: string]: number };
}> => {
  
  let totalRevenue = 0;
  const itemRevenues: { [itemName: string]: number } = {};
  
  // Helper functions for butcher type detection
  const butcherType = getButcherType(butcherId);
  const fishButcher = butcherType === 'fish';
  
  for (const item of order.items) {
    const itemName = item.name;
    const itemSize = item.size || 'default'; // Get size from order item, default to 'default' if not present
    const itemKey = `${itemName}_${itemSize}`; // Use itemName_size as key for revenue tracking
    const rejected = (item as any).rejected;
    
    // ✅ FIX: Skip rejected items (no revenue for rejected items)
    if (rejected) {
      console.log(`Skipping ${itemName} (${itemSize}) - rejected: ${rejected}`);
      itemRevenues[itemKey] = 0;
      continue;
    }
    
    // Get preparing weight (fish butchers use itemWeights, meat butchers use itemQuantities)
    const preparingWeight = parseFloat(
      String(fishButcher
        ? order.itemWeights?.[itemName] ?? item.quantity
        : order.itemQuantities?.[itemName] ?? item.quantity)
    );
    
    console.log(`Calculating revenue for ${itemName} (${itemSize}): ${preparingWeight}kg (${fishButcher ? 'fish' : 'meat'} butcher)`);
    
    // Get purchase price and category from menu (pass size parameter)
    const { price: purchasePrice, category: menuCategory } = await getPurchasePriceFromMenu(butcherId, itemName, itemSize);
    // Use category from menu (found when looking up price) instead of item.category
    const category = menuCategory || item.category || 'default';
    const commissionRate = getCommissionRate(butcherId, category);
    
    // Calculate item revenue: (Purchase Price × Weight) - Commission% of (Purchase Price × Weight)
    const itemRevenue = (purchasePrice * preparingWeight) - (commissionRate * purchasePrice * preparingWeight);
    
    itemRevenues[itemKey] = itemRevenue;
    totalRevenue += itemRevenue;
  }
  
  return { totalRevenue, itemRevenues };
};

/**
 * Prepare order: Calculate revenue and update butcher sheet
 * This happens when user enters preparing weights
 */
export const prepareOrder = async (order: Order, butcherId: string): Promise<Order> => {
  try {
    // Step 1: Calculate revenue centrally
    const { totalRevenue, itemRevenues } = await calculateOrderRevenue(order, butcherId);
    
    // Step 2: Update order with calculated revenue and preparing status
    const updatedOrder = {
      ...order,
      revenue: totalRevenue,
      itemRevenues: itemRevenues,
      status: 'preparing' as const,
      preparationStartTime: new Date()
    };
    
    // Step 3: Update butcher sheet with preparing order (including revenue)
    await updateOrderInSheet(updatedOrder, butcherId);
    
    return updatedOrder;
    
  } catch (error) {
    console.error(`[Order] Failed to prepare order ${order.id}:`, error);
    throw error;
  }
};

/**
 * Complete order: Save to sales sheet
 * This happens when order is marked as completed
 */
export const completeOrder = async (order: Order, butcherId: string): Promise<void> => {
  // Validate order data
  if (!order.items || order.items.length === 0) {
    throw new Error(`Order ${order.id} has no items. Cannot complete order without items.`);
  }
  
  try {
    // Extract order number from order ID to get cached order with preparing weights
    const orderIdParts = order.id.replace('ORD-', '').split('-');
    const orderNo = parseInt(orderIdParts[orderIdParts.length - 1], 10);
    
    // Get the full order from cache FIRST to preserve preparing weights (itemWeights/itemQuantities)
    // The cached order has the preparing weights that were set when the order was accepted
    const { getOrderFromCache } = await import('./orderCache');
    const cachedOrder = getOrderFromCache(butcherId, orderNo);
    
    // Use cached order as base (has preparing weights), merge with incoming order updates
    // This ensures preparing weights are preserved when marking as completed
    const orderWithWeights = cachedOrder ? {
      ...cachedOrder, // Use cached order as base (has itemWeights/itemQuantities)
      ...order, // Apply any updates from incoming order
    } : order; // Fallback to incoming order if not in cache
    
    // Step 1: Update order status to completed
    // Ensure preparationStartTime is set (use current time if not set)
    const now = new Date();
    const completedOrder = {
      ...orderWithWeights,
      status: 'completed' as const,
      completionTime: Date.now(), // Use timestamp instead of string
      preparationStartTime: orderWithWeights.preparationStartTime || now, // Set start time if not already set
      preparationEndTime: now // Set end time for completion time calculation
    };
    
    // Step 2: Update butcher sheet with completed status (preserving preparing weights)
    await updateOrderInSheet(completedOrder, butcherId);
    
    // Step 3: Save to sales sheet with all order details
    const { saveSalesDataToSheet } = await import('./salesSheets');
    await saveSalesDataToSheet(order.id, butcherId, completedOrder);
    console.log(`[Order] Saved to Sales VCS sheet: Order ${order.id}`);
    
  } catch (error) {
    console.error(`[Order] Failed to complete order ${order.id}:`, error);
    throw error;
  }
};

/**
 * Save commission and markup rates to Google Sheets
 */
export const saveRatesToSheet = async (butcherRates: ButcherRates[]): Promise<void> => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getSheetSheetsClient('pos');
        
        // Create or update the "Rates" tab
        const ratesTabName = 'Rates';
        
        // Prepare header row
        const headerRow = [
            'Butcher ID',
            'Butcher Name', 
            'Category',
            'Commission Rate (%)',
            'Markup Rate (%)',
            'Last Updated'
        ];

        // Prepare data rows
        const dataRows: any[][] = [];
        const currentDate = new Date().toLocaleDateString('en-GB');
        
        for (const butcher of butcherRates) {
            // Get all unique categories for this butcher
            const allCategories = new Set([
                ...butcher.commissionRates.map(cr => cr.category),
                ...butcher.markupRates.map(mr => mr.category)
            ]);
            
            for (const category of allCategories) {
                const commissionRate = butcher.commissionRates.find(cr => cr.category === category);
                const markupRate = butcher.markupRates.find(mr => mr.category === category);
                
                dataRows.push([
                    butcher.butcherId,
                    butcher.butcherName,
                    category,
                    commissionRate ? (commissionRate.rate * 100).toFixed(1) : '0.0',
                    markupRate ? (markupRate.rate * 100).toFixed(1) : '0.0',
                    currentDate
                ]);
            }
        }

        // Check if Rates tab exists, create it if it doesn't
        console.log('Checking if Rates tab exists...');
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: BUTCHER_POS_SHEET_ID,
        });
        
        const existingSheets = spreadsheet.data.sheets || [];
        const ratesTabExists = existingSheets.some(sheet => sheet.properties?.title === ratesTabName);
        
        if (!ratesTabExists) {
            console.log('Rates tab does not exist, creating it...');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: ratesTabName,
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: 6
                                }
                            }
                        }
                    }]
                }
            });
            console.log('Rates tab created successfully');
        } else {
            console.log('Rates tab already exists');
        }

        // Clear existing data and write new data
        const range = `${ratesTabName}!A:F`;
        console.log('Using range:', range);
        
        // Clear existing data
        try {
            console.log('Clearing existing data...');
            await sheets.spreadsheets.values.clear({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range,
            });
            console.log('Data cleared successfully');
        } catch (error) {
            console.log('Error clearing data (this is normal for new tabs):', error);
        }

        // Write header and data
        const allRows = [headerRow, ...dataRows];
        console.log('Writing data to sheet...');
        console.log('Total rows to write:', allRows.length);
        
        const result = await sheets.spreadsheets.values.update({
            spreadsheetId: BUTCHER_POS_SHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: allRows
            }
        });

        console.log('Write result:', result.data);
        console.log(`Successfully saved rates for ${butcherRates.length} butchers to Google Sheets`);

    } catch (error: any) {
        console.error('Detailed error saving rates to sheet:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', error.details);
        throw new Error(`Failed to save rates: ${error.message}`);
    }
};

/**
 * Get commission and markup rates from Google Sheets
 */
export const getRatesFromSheet = async (): Promise<ButcherRates[]> => {
    try {
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getSheetSheetsClient('pos');
        const ratesTabName = 'Rates';
        
        // Try to read from the Rates tab
        try {
            const range = `${ratesTabName}!A:F`;
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range,
            });

            const rows = response.data.values || [];
            
            if (rows.length <= 1) {
                // No data or only header, return defaults
                return getDefaultButcherRates();
            }

            // Skip header row and parse data
            const dataRows = rows.slice(1);
            const butcherRatesMap: { [butcherId: string]: ButcherRates } = {};

            for (const row of dataRows) {
                const [butcherId, butcherName, category, commissionRateStr, markupRateStr] = row;
                
                if (!butcherId || !category) continue;

                // Initialize butcher if not exists
                if (!butcherRatesMap[butcherId]) {
                    butcherRatesMap[butcherId] = {
                        butcherId,
                        butcherName: butcherName || butcherId,
                        commissionRates: [],
                        markupRates: []
                    };
                }

                // Parse rates
                const commissionRate = parseFloat(commissionRateStr) / 100 || 0.07; // Default to 7%
                const markupRate = parseFloat(markupRateStr) / 100;
                
                // Use correct default based on category if parsing failed
                let finalMarkupRate = markupRate;
                if (isNaN(markupRate)) {
                    // Beef and mutton items have 0% markup by default
                    if (category.toLowerCase() === 'beef' || category.toLowerCase() === 'mutton' || 
                        category.toLowerCase().includes('beef') || category.toLowerCase().includes('mutton')) {
                        finalMarkupRate = 0.00;
                    } else {
                        finalMarkupRate = 0.05; // 5% for other items
                    }
                }

                // Add commission rate
                butcherRatesMap[butcherId].commissionRates.push({
                    butcherId,
                    category,
                    rate: commissionRate
                });

                // Add markup rate
                butcherRatesMap[butcherId].markupRates.push({
                    butcherId,
                    category,
                    rate: finalMarkupRate
                });
            }

            const result = Object.values(butcherRatesMap);
            return result;

        } catch (error) {
            // Rates tab doesn't exist, return defaults
            console.log('Rates tab not found, returning default rates. Error:', error);
            return getDefaultButcherRates();
        }

    } catch (error: any) {
        console.error('Error getting rates from sheet:', error);
        // Return defaults on error
        return getDefaultButcherRates();
    }
};

export const getPurchasePriceFromMenu = async (
  butcherId: string,
  itemName: string,
  size: string = 'default'
): Promise<{ price: number; category: string }> => {
  try {
    // Step 1: Find category for item using name matching
    const categoryName = findCategoryForItem(butcherId, itemName);
    if (!categoryName) {
      console.warn(`[getPurchasePriceFromMenu] No category found for item "${itemName}" in butcher "${butcherId}"`);
      return { price: 0, category: 'default' };
    }
    
    // Step 2: Get the correct sheet tab based on butcher type and category
    const tabName = getPriceSheetTab(butcherId, categoryName);
    if (!tabName) {
      console.error(`[getPurchasePriceFromMenu] No sheet tab found for butcher "${butcherId}" and category "${categoryName}"`);
      return { price: 0, category: categoryName };
    }
    
    const sheets = await getSheetSheetsClient('menu');
    const spreadsheetId = process.env.MENU_POS_SHEET_ID;
    if (!spreadsheetId) {
      console.error('Menu POS Spreadsheet ID not found');
      return { price: 0, category: categoryName };
    }
    
    // Determine if this is a meat butcher based on category
    const itemType = getItemTypeFromCategory(categoryName);
    const isMeat = itemType === 'meat';
    
    // For meat butchers: Purchase Price is in column C (index 2)
    // For fish butchers: Size is in column C (index 2), Purchase Price is in column D (index 3)
    const sizeColumn = isMeat ? -1 : 2; // Column C (index 2) for fish, not needed for meat
    const priceColumn = isMeat ? 2 : 3; // Column C for meat, Column D for fish
    
    // Read appropriate range based on butcher type
    // Meat: A:G (Item Name, Category, Purchase Price, Selling Price, Unit, nos weight, Date) - read full range to ensure correct column mapping
    // Fish: A:H (Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight, Date) - read full range to ensure correct column mapping
    const range = `${tabName}!A:${isMeat ? 'G' : 'H'}`;
    
    // Fetch data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });
    
    const rows = response.data.values || [];
    
    // Extract English name (middle part) from three-language format if present
    // Format: "Manglish - English - Malayalam" -> extract "English"
    let itemNameToMatch = itemName;
    if (itemName.includes(' - ') && itemName.split(' - ').length >= 3) {
      const nameParts = itemName.split(' - ');
      itemNameToMatch = nameParts[1].trim(); // English name is in the middle
    }
    
    const normalizedItemName = normalizeItemName(itemNameToMatch);
    const normalizedSize = size.toLowerCase();
    
    // ✅ FIX: For meat butchers, ALWAYS match by item name only (ignore size completely)
    // For fish butchers: If size is 'default', match by item name only; otherwise match by item name + size
    const isDefaultSize = normalizedSize === 'default';
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const menuItem = normalizeItemName(row[0] || '');
      
      // For meat butchers, ONLY check item name (completely ignore size parameter)
      if (isMeat) {
        if (menuItem === normalizedItemName) {
          // Ensure we have the price column
          if (row.length > priceColumn) {
            const price = parseFloat(row[priceColumn]) || 0;
            // Debug: Log the row data to verify column mapping
            console.log(`[getPurchasePriceFromMenu] Found match for "${itemName}" in ${butcherId}:`, {
              itemName: row[0],
              category: row[1],
              purchasePrice: row[2],
              sellingPrice: row[3],
              priceColumn,
              parsedPrice: price
            });
            if (price > 0) {
              // Use the category we found from matching, not from sheet
              return { price, category: categoryName };
            }
          }
        }
      } else {
        // For fish butchers
        if (menuItem === normalizedItemName) {
          // If size is 'default', match by item name only (return first matching price)
          if (isDefaultSize) {
            if (row.length > priceColumn) {
              const price = parseFloat(row[priceColumn]) || 0;
              if (price > 0) {
                const category = (row[1] || 'default').trim();
                return { price, category };
              }
            }
          } else {
            // If size is 'small', 'medium', or 'big', match by item name + size
            if (row.length > sizeColumn && row.length > priceColumn) {
              const menuSize = (row[sizeColumn] || '').toLowerCase().trim();
              if (menuSize === normalizedSize) {
                const price = parseFloat(row[priceColumn]) || 0;
                if (price > 0) {
                  const category = (row[1] || 'default').trim();
                  return { price, category };
                }
              }
            }
          }
        }
      }
    }
    
    // ✅ FIX: If size was 'default' and no match found for fish butchers, try to find any size for this item
    // This handles edge cases where item exists but we need a fallback
    // Note: This fallback is NOT needed for meat butchers since they don't have sizes
    if (isDefaultSize && !isMeat) {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const menuItem = normalizeItemName(row[0] || '');
        if (menuItem === normalizedItemName) {
          if (row.length > priceColumn) {
            const price = parseFloat(row[priceColumn]) || 0;
            if (price > 0) {
              // Use the category we found from matching, not from sheet
              return { price, category: categoryName };
            }
          }
        }
      }
    }
    
    // No match found - return 0 with found category
    console.warn(`[getPurchasePriceFromMenu] No price found for "${itemName}" in sheet tab "${tabName}"`);
    return { price: 0, category: categoryName };
  } catch (error) {
    console.error(`[Order] Error fetching purchase price for "${itemName}" in ${butcherId}:`, error);
    // Try to get category even on error
    const categoryName = findCategoryForItem(butcherId, itemName) || 'default';
    return { price: 0, category: categoryName };
  }
};