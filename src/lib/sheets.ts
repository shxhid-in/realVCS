'use server';

import { google } from 'googleapis';
import type { Order, OrderItem, MenuCategory, Butcher, MenuItem, CommissionRate, MarkupRate, ButcherRates } from './types';
import { freshButchers as butchers, getFishItemFullName } from './freshMockData';
import { getDefaultButcherRates, getCommissionRate, getMarkupRate } from './rates';
import { measureApiCall } from './apiMonitor';
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
  'usaj_mutton': 'Usaj_Mutton_Shop'
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
            console.warn(`No butcher-specific credentials found for ${butcherId}, falling back to default`);
            return getGoogleSheetsClient();
        }

        // Debug private key format
        const processedPrivateKey = credentials.privateKey.replace(/\\n/g, '\n');

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: credentials.clientEmail,
                private_key: processedPrivateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        return google.sheets({ version: 'v4', auth: client as any });
    } catch (error) {
        console.error(`Error creating butcher-specific Google Sheets client for ${butcherId}:`, error);
        // Fallback to default client
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

// Note: Commission rates are now managed dynamically through the rates system

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
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        
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
    if (['kak', 'ka_sons', 'alif'].includes(butcherId)) {
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
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        
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
                size = 'default'; // Meat items don't have sizes
            } else {
                // Fish butchers: Item Name, Category, Size, Purchase Price, Selling Price, Unit, nos weight
                [itemName, , size, purchasePriceStr] = row;
            }
            
            if (!itemName || !purchasePriceStr) continue;

            const purchasePrice = parseFloat(purchasePriceStr) || 0;
            if (purchasePrice > 0) {
                // For fish butchers, extract English name from format "Malayalam - English - Tamil"
                let cleanItemName = itemName;
                if (isFishButcher(butcherId) && itemName.includes(' - ')) {
                    const nameParts = itemName.split(' - ');
                    cleanItemName = nameParts.length >= 2 ? nameParts[1].trim() : itemName;
                }
                
                // For fish butchers with sizes, include size in the key for more precise matching
                if (isFishButcher(butcherId) && size && size !== 'default') {
                    const keyWithSize = `${cleanItemName.toLowerCase().trim()} (${size})`;
                    purchasePrices[keyWithSize] = purchasePrice;
                }
                
                // Always store the base name without size for fallback matching
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

// Helper function to determine if a butcher is a meat butcher
function isMeatButcher(butcherId: string): boolean {
    return ['usaj', 'usaj_mutton', 'pkd'].includes(butcherId);
}

// Helper function to determine if a butcher is a fish butcher
function isFishButcher(butcherId: string): boolean {
    return ['kak', 'ka_sons', 'alif'].includes(butcherId);
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
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        
        // Updated column structures based on butcher type
        // Meat butchers: Item Name | Category | Purchase Price | Selling Price | Unit | nos weight (6 columns)
        // Fish butchers: Item Name | Category | Size | Purchase Price | Selling Price | Unit | nos weight (7 columns)
        const range = isMeatButcher ? `${tabName}!A2:F` : `${tabName}!A2:G`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: MENU_POS_SHEET_ID,
            range,
        });

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
                size = 'default'; // Meat items don't have sizes
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
                const price = parseFloat(purchasePrice) || 450; // Default fallback
                
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
                    
                    // Extract English name from order item name if it's in fish format
                    let orderEnglishName = baseOrderItemName;
                    if (orderItemName.includes(' - ') && orderItemName.split(' - ').length >= 3) {
                        const nameParts = orderItemName.split(' - ');
                        orderEnglishName = nameParts[1].trim(); // Keep original case
                    }
                    
                    // Get order item details for better matching
                    const orderItem = orderItems?.find(item => item.name === orderItemName);
                    const orderItemCategory = orderItem?.category?.toLowerCase().trim();
                    const orderItemSize = orderItem?.size?.toLowerCase().trim() || 'default';
                    
                    // Case-sensitive exact matching logic with size consideration
                    let isMatch = false;
                    
                    if (isMeatButcher) {
                        // Meat butchers: Exact case-sensitive and space-sensitive matching (no size consideration)
                        console.log(`Meat butcher matching: "${baseItemName}" vs "${baseOrderItemName}": ${baseItemName === baseOrderItemName}`);
                        if (baseItemName === baseOrderItemName) {
                            isMatch = true;
                            console.log(`✅ Exact match found for meat butcher: "${baseItemName}"`);
                        } else {
                            // Try case-insensitive matching for meat butchers
                            if (baseItemName.toLowerCase() === baseOrderItemName.toLowerCase()) {
                                isMatch = true;
                                console.log(`✅ Case-insensitive match found for meat butcher: "${baseItemName}"`);
                            }
                        }
                    } else {
                        // Fish butchers: Enhanced matching with size consideration (case-sensitive and space-sensitive)
                        
                        // First, try exact case-sensitive match with size: "Mackerel Small"
                        if (orderItemSize && orderItemSize !== 'default' && size && size !== 'default') {
                            const itemWithSize = `${baseItemName} ${size}`;
                            const orderWithSize = `${baseOrderItemName} ${orderItemSize}`;
                            
                            if (itemWithSize === orderWithSize) {
                            isMatch = true;
                                console.log(`✅ Fish butcher exact size match: "${itemWithSize}" = "${orderWithSize}"`);
                            }
                            
                            // Try with parentheses: "Mackerel (Small)"
                            if (!isMatch) {
                                const itemWithParentheses = `${baseItemName} (${size})`;
                                const orderWithParentheses = `${baseOrderItemName} (${orderItemSize})`;
                                
                                if (itemWithParentheses === orderWithParentheses) {
                            isMatch = true;
                                    console.log(`✅ Fish butcher parentheses size match: "${itemWithParentheses}" = "${orderWithParentheses}"`);
                                }
                            }
                            
                            // Try case-insensitive size match
                            if (!isMatch) {
                                const itemWithSizeLower = `${baseItemName.toLowerCase()} ${size.toLowerCase()}`;
                                const orderWithSizeLower = `${baseOrderItemName.toLowerCase()} ${orderItemSize.toLowerCase()}`;
                                
                                if (itemWithSizeLower === orderWithSizeLower) {
                                    isMatch = true;
                                    console.log(`✅ Fish butcher case-insensitive size match: "${itemWithSizeLower}" = "${orderWithSizeLower}"`);
                                }
                            }
                        }
                        
                        // If no size match, try exact case-sensitive match with English name
                        if (!isMatch && baseItemName === orderEnglishName) {
                            // Check if sizes match (if both have sizes)
                            if (size && size !== 'default' && orderItemSize && orderItemSize !== 'default') {
                                if (size.toLowerCase() === orderItemSize) {
                                    isMatch = true;
                                    console.log(`✅ Fish butcher English name with size match: "${baseItemName}" + "${size}"`);
                                }
                            } else if (!size || size === 'default' || !orderItemSize || orderItemSize === 'default') {
                                // If either doesn't have size, match by name only
                                isMatch = true;
                                console.log(`✅ Fish butcher English name match: "${baseItemName}"`);
                            }
                        }
                        
                        // No longer using "meat" suffix for fish butchers' meat items
                        // Fish butchers will match items using original names
                        
                        // Try exact match with original item name (case-sensitive)
                        if (!isMatch && baseItemName === baseOrderItemName) {
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
                        // If meat category item, try original name with "meat" suffix (case-sensitive)
                        else if (orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                 baseItemName === `${baseOrderItemName} meat`) {
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
                        exactMatchOriginal: baseItemName === baseOrderItemName,
                        exactMatchEnglish: !isMeatButcher && baseItemName === orderEnglishName,
                        meatSuffixMatchEnglish: !isMeatButcher && orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                             baseItemName === `${orderEnglishName} meat`,
                        meatSuffixMatchOriginal: !isMeatButcher && orderItemCategory && orderItemCategory.toLowerCase().includes('meat') && 
                                               baseItemName === `${baseOrderItemName} meat`
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
                            isExactMatch: baseItemName === baseOrderItemName || baseItemName === orderEnglishName,
                            isPartialMatch: baseItemName.includes(baseOrderItemName) || baseOrderItemName.includes(baseItemName) ||
                                         baseItemName.includes(orderEnglishName) || orderEnglishName.includes(baseItemName),
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
                    console.log(`❌ No fuzzy match found for ${itemName}, using default 450`);
                    prices[itemName] = 450; // Default price
                }
            }
        });
        
        console.log(`\n=== FINAL PRICE LOOKUP RESULT for ${butcherId} ===`);
        console.log(`Sheet rows found: ${rows.length}`);
        console.log(`Items requested: ${itemNames.join(', ')}`);
        console.log(`Items matched: ${Object.keys(prices).join(', ')}`);
        console.log(`Final prices:`, prices);
        console.log(`Sheet was empty: ${rows.length === 0}`);
        
        // Debug: Show all available menu items for comparison
        console.log(`\n=== AVAILABLE MENU ITEMS IN SHEET ===`);
        rows.forEach((row, index) => {
            if (isMeatButcher) {
                const [itemName, , purchasePrice] = row;
                console.log(`Row ${index + 1}: "${itemName}" -> ₹${purchasePrice}`);
            } else {
                const [itemName, , size, purchasePrice] = row;
                console.log(`Row ${index + 1}: "${itemName}" (${size}) -> ₹${purchasePrice}`);
            }
        });
        console.log(`==========================================\n`);
        
        console.log(`\n=== FINAL PRICES OBJECT ===`);
        console.log('Prices found:', prices);
        console.log('Number of prices:', Object.keys(prices).length);
        console.log('Price keys:', Object.keys(prices));
        console.log(`=============================\n`);
        
        // Special check for ayakoora meat
        const ayakooraItems = rows.filter(row => {
            const itemName = isMeatButcher ? row[0] : row[0];
            return itemName && itemName.toLowerCase().includes('ayakoora');
        });
        if (ayakooraItems.length > 0) {
            console.log(`\n🔍 AYAKOORA ITEMS FOUND IN SHEET:`);
            ayakooraItems.forEach((row, index) => {
                if (isMeatButcher) {
                    const [itemName, , purchasePrice] = row;
                    console.log(`Ayakoora ${index + 1}: "${itemName}" -> ₹${purchasePrice}`);
                } else {
                    const [itemName, , size, purchasePrice] = row;
                    console.log(`Ayakoora ${index + 1}: "${itemName}" (${size}) -> ₹${purchasePrice}`);
                }
            });
            console.log(`==========================================\n`);
        } else {
            console.log(`\n❌ NO AYAKOORA ITEMS FOUND IN SHEET`);
            console.log(`==========================================\n`);
        }

        return prices;
    } catch (error: any) {
        console.error('Error fetching item prices:', error);
        // Return default prices for all items
        const defaultPrices: {[itemName: string]: number} = {};
        itemNames.forEach(itemName => {
            defaultPrices[itemName] = 450;
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
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
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
            
            if (isMeat) {
                // Meat butchers: Parse preparing weight column for custom weights
                preparingWeights = parseArrayFromSheet(preparingWeight || '');
                // If no custom weights found, fall back to quantities
                if (preparingWeights.length === 0 || preparingWeights.every(w => !w || w.trim() === '')) {
                preparingWeights = quantities;
                }
            } else {
                // Fish butchers: Use preparing weight column
                preparingWeights = parseArrayFromSheet(preparingWeight || '');
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

                return {
                    id: `${orderNo}-${index}`,
                    name: displayName,
                    quantity: parsedQty,
                    unit,
                    cutType: cut || undefined,
                    size: itemSize || undefined
                };
            });

            // Determine order status based on sheet status or fallback to data analysis
            let status: Order['status'] = 'new';
            let prepStartTime: Date | undefined;
            let prepEndTime: Date | undefined;
            let pickedWeight: number | undefined;
            let finalWt: number | undefined;
            let revenue: number | undefined;

            // Map sheet status to internal status
            let rejectionReason: string | undefined;
            if (statusFromSheet && statusFromSheet.trim()) {
                const sheetStatus = statusFromSheet.toLowerCase().trim();
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
                    // Parse revenue from sheet (could be comma-separated for multiple items)
                    const revenueValues = parseArrayFromSheet(revenueFromSheet);
                    if (revenueValues.length > 0) {
                        // Sum up all revenue values if there are multiple items
                        revenue = revenueValues.reduce((sum, rev) => sum + (parseFloat(rev) || 0), 0);
                        console.log(`Order ${orderNo}: Reading revenue from sheet: "${revenueFromSheet}" -> parsed: [${revenueValues.join(', ')}] -> total: ${revenue}`);
                    }
                } else if (preparingWeights.length > 0) {
                    // Fallback: Calculate revenue using preparing weight with default rate
                    const totalPreparingWeight = preparingWeights.reduce((sum, w) => sum + (parseFloat(w) || 0), 0);
                    revenue = totalPreparingWeight * 450; // Default rate fallback
                    console.log(`Order ${orderNo}: No revenue in sheet, using fallback calculation: ${totalPreparingWeight} * 450 = ${revenue}`);
                }
            } else if (status === 'rejected') {
                // For rejected orders, read revenue from sheet if available
                if (revenueFromSheet && revenueFromSheet.trim()) {
                    // Parse revenue from sheet (could be comma-separated for multiple items)
                    const revenueValues = parseArrayFromSheet(revenueFromSheet);
                    if (revenueValues.length > 0) {
                        // Sum up all revenue values if there are multiple items
                        revenue = revenueValues.reduce((sum, rev) => sum + (parseFloat(rev) || 0), 0);
                        console.log(`Order ${orderNo}: Reading rejected order revenue from sheet: "${revenueFromSheet}" -> parsed: [${revenueValues.join(', ')}] -> total: ${revenue}`);
                    }
                } else {
                    // For rejected orders without revenue in sheet, calculate potential revenue based on quantities
                    const totalQuantity = quantities.reduce((sum, q) => sum + (parseFloat(q) || 0), 0);
                    revenue = totalQuantity * 450; // Default rate for potential revenue
                    console.log(`Order ${orderNo}: No revenue in sheet for rejected order, calculating potential revenue: ${totalQuantity} * 450 = ${revenue}`);
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
                ...(isMeat ? { itemQuantities } : { itemWeights })
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
        // Order saved - polling will pick up changes
        
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Extract order number from order ID (ORD-2024-01-15-123 -> 123)
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = orderIdParts[orderIdParts.length - 1]; // Get the last part (order number)
        
        // Format data for sheet
        const items = formatArrayForSheet(order.items.map(item => item.name));
        const quantities = formatArrayForSheet(order.items.map(item => `${item.quantity}${item.unit}`));
        const sizes = formatArrayForSheet(order.items.map(item => item.size || ''));
        const cutTypes = formatArrayForSheet(order.items.map(item => item.cutType || ''));
        
        // Get order date in DD/MM/YYYY format (use order's date or current date)
        const orderDate = order.orderTime ? 
            new Date(order.orderTime).toLocaleDateString('en-GB') : 
            new Date().toLocaleDateString('en-GB');
        
        // Determine butcher type for preparing weight initialization
        const isMeat = isMeatButcher(butcherId);
        
        // For meat butchers, initialize preparing weight with quantities
        // For fish butchers, leave preparing weight empty initially
        const initialPreparingWeight = isMeat ? quantities : '';
        
        const rowData = [
            orderDate, // Order Date (use actual order date)
            orderNo,
            items,
            quantities,
            sizes, // Size column (new)
            cutTypes,
            initialPreparingWeight, // preparing weight (quantities for meat, empty for fish)
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
 * Update order status in the Butcher POS sheet
 */
export const updateOrderInSheet = async (order: Order, butcherId: string) => {
    try {
        console.log('\n=== UPDATE ORDER IN SHEET START ===');
        console.log('Order ID:', order.id);
        console.log('Butcher ID:', butcherId);
        console.log('Order Status:', order.status);
        console.log('Rejection Reason:', order.rejectionReason);
        console.log('BUTCHER_POS_SHEET_ID:', BUTCHER_POS_SHEET_ID ? 'Set' : 'Not Set');
        
        // Order updated - polling will pick up changes
        
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Extract order number from order ID (ORD-2024-01-15-123 -> 123)
        const orderIdParts = order.id.replace('ORD-', '').split('-');
        const orderNo = orderIdParts[orderIdParts.length - 1]; // Get the last part (order number)
        
        // Get the order date from the order object or use current date
        const orderDate = order.orderTime ? 
            new Date(order.orderTime).toLocaleDateString('en-GB') : 
            new Date().toLocaleDateString('en-GB');
        
        // Find the row with this order number AND date combination
        const range = `${tabName}!A:K`;
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
        
        for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header
            const rowDate = rows[i][0]; // Order Date is in column A (index 0)
            const rowOrderNo = rows[i][1]; // Order No is in column B (index 1)
            
            console.log(`Searching row ${i}: date="${rowDate}", orderNo="${rowOrderNo}" vs target: date="${orderDate}", orderNo="${orderNo}"`);
            
            // Match both date and order number to ensure uniqueness
            if (rowDate === orderDate && rowOrderNo === orderNo) {
                rowIndex = i + 1; // Sheet rows are 1-indexed
                console.log(`✅ Found matching order at row ${rowIndex}`);
                break;
            }
        }

        if (rowIndex === -1) {
            throw new Error(`Order ${orderNo} for date ${orderDate} not found in sheet`);
        }

        // Determine butcher type for column structure
        const isMeat = isMeatButcher(butcherId);
        
        // Prepare update data based on butcher type
        let preparingWeight = '';
        console.log('\n=== UPDATE ORDER IN SHEET DEBUG ===');
        console.log('Order ID:', order.id);
        console.log('Butcher ID:', butcherId);
        console.log('Is Meat Butcher:', isMeat);
        console.log('Order itemQuantities:', order.itemQuantities);
        console.log('Order itemWeights:', order.itemWeights);
        console.log('Order pickedWeight:', order.pickedWeight);
        console.log('Order itemQuantities:', order.itemQuantities);
        console.log('Order itemWeights:', order.itemWeights);
        
        if (isMeat) {
            // Meat butchers: Use itemQuantities (user-entered preparing weights) for the preparing weight column
            preparingWeight = order.itemQuantities ? 
                Object.values(order.itemQuantities).join(',') : 
                (order.pickedWeight ? order.pickedWeight.toString() : '');
            console.log('Meat butcher - preparingWeight from itemQuantities:', preparingWeight);
        } else {
            // Fish butchers: Use itemWeights (user-entered preparing weights) for the preparing weight column
            preparingWeight = order.itemWeights ? 
                Object.values(order.itemWeights).join(',') : 
                (order.pickedWeight ? order.pickedWeight.toString() : '');
            console.log('Fish butcher - preparingWeight from itemWeights:', preparingWeight);
        console.log('Fish butcher - itemWeights keys:', order.itemWeights ? Object.keys(order.itemWeights) : 'none');
        console.log('Fish butcher - itemWeights values:', order.itemWeights ? Object.values(order.itemWeights) : 'none');
        console.log('Fish butcher - order items:', order.items.map(item => item.name));
        console.log('Fish butcher - order itemWeights mapping:', order.itemWeights ? Object.entries(order.itemWeights) : 'none');
        }
        console.log('Final preparingWeight to save:', preparingWeight);
        console.log('=====================================\n');
            
        const completionTime = order.completionTime && order.completionTime > 0 ? `${order.completionTime} min` : '5 min'; // Default to 5 min if no completion time
        const startTime = order.preparationStartTime ? 
            (order.preparationStartTime instanceof Date ? 
                order.preparationStartTime.toISOString() : 
                new Date(order.preparationStartTime).toISOString()) : '';
        
        // Map internal status to sheet status
        let sheetStatus = '';
        switch (order.status) {
            case 'new':
                sheetStatus = 'New';
                break;
            case 'preparing':
                if (isMeat) {
                    sheetStatus = 'Preparing';
                } else {
                    sheetStatus = preparingWeight ? 'Preparing' : 'Accepted';
                }
                break;
            case 'completed':
                sheetStatus = 'Ready to Pick Up';
                break;
            case 'rejected':
                // Store rejection reason in status column with a prefix to identify it
                sheetStatus = order.rejectionReason ? `REJECTED: ${order.rejectionReason}` : 'Declined';
                break;
            default:
                sheetStatus = 'New';
        }
        
        // Format revenue for sheet (comma-separated for multiple items)
        const revenueForSheet = order.itemRevenues ? 
            Object.values(order.itemRevenues).map(rev => rev.toFixed(2)).join(',') : 
            (order.revenue ? order.revenue.toFixed(2) : '');

        console.log('\n=== BUTCHER POS SHEET UPDATE DEBUG ===');
        console.log('Order details:', {
            orderId: order.id,
            orderNo,
            orderDate,
            rowIndex,
            preparingWeight,
            completionTime,
            startTime,
            sheetStatus,
            revenueForSheet,
            orderRevenue: order.revenue,
            orderItemRevenues: order.itemRevenues,
            butcherId,
            tabName,
            range: `${tabName}!G${rowIndex}:K${rowIndex}`,
            values: [[preparingWeight, completionTime, startTime, sheetStatus, revenueForSheet]],
            hasRevenue: !!order.revenue,
            hasItemRevenues: !!order.itemRevenues,
            revenueType: typeof order.revenue,
            itemRevenuesType: typeof order.itemRevenues
        });
        console.log('Revenue calculation details:', {
            orderRevenue: order.revenue,
            itemRevenues: order.itemRevenues,
            revenueForSheet,
            revenueCalculation: order.itemRevenues ? 
                Object.entries(order.itemRevenues).map(([item, rev]) => `${item}: ₹${rev.toFixed(2)}`).join(', ') :
                `Total: ₹${order.revenue?.toFixed(2) || '0.00'}`
        });
        console.log('==========================================\n');

        // Update the specific row - both meat and fish butchers have same column structure
        // columns G, H, I, J, K (preparing weight, completion time, start time, status, revenue)
        // Note: Size column is now at position 5 (F), so preparing weight moved to position 6 (G)
        const updateRange = `${tabName}!G${rowIndex}:K${rowIndex}`;
        const updateValues = [[preparingWeight, completionTime, startTime, sheetStatus, revenueForSheet]];
        
        console.log('Sending update to Google Sheets:', {
            spreadsheetId: BUTCHER_POS_SHEET_ID,
            range: updateRange,
            values: updateValues,
            butcherType: isMeat ? 'meat' : 'fish'
        });
        
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
        
        console.log('Google Sheets update response:', {
            status: updateResponse.status,
            statusText: updateResponse.statusText,
            data: updateResponse.data,
            updatedRange: updateResponse.data?.updatedRange,
            updatedCells: updateResponse.data?.updatedCells
        });
        
        if (updateResponse.status !== 200) {
            throw new Error(`Google Sheets update failed with status ${updateResponse.status}`);
        }
        
        console.log('✅ Order updated successfully in Google Sheets');
        console.log('=== UPDATE ORDER IN SHEET END ===\n');

    } catch (error: any) {
        console.error('Error updating order in sheet:', error);
        
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
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine butcher type
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        const isFishButcher = ['kak', 'ka_sons', 'alif'].includes(butcherId);
        
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
                    
                    // No longer adding "meat" suffix for fish butchers' meat items
                    // Fish butchers will use the original item names without suffix
                    
                    // Calculate selling price with markup based on category (load from Google Sheets)
                    const categoryName = category.name.toLowerCase();
                    const customRates = await getRatesFromSheet();
                    const butcherCustomRates = customRates.find(r => r.butcherId === butcherId);
                    
                    // Debug logging for rates loading
                    console.log(`=== MARKUP CALCULATION DEBUG for ${butcherId} ===`);
                    console.log('Original category name:', category.name);
                    console.log('Category name (lowercase):', categoryName);
                    console.log('Custom rates loaded:', customRates.length);
                    console.log('Butcher custom rates found:', !!butcherCustomRates);
                    if (butcherCustomRates) {
                        console.log('Butcher markup rates:', butcherCustomRates.markupRates);
                    }
                    
                    const markupRate = getMarkupRate(butcherId, categoryName, butcherCustomRates?.markupRates);
                    
                    // Debug logging for markup calculation
                    console.log(`Final markup calculation for ${butcherId}:`, {
                        itemName: itemName,
                        categoryName: categoryName,
                        purchasePrice: size.price,
                        markupRate: markupRate,
                        markupPercentage: (markupRate * 100).toFixed(1) + '%',
                        sellingPrice: Math.round(size.price * (1 + markupRate))
                    });
                    console.log('=== END MARKUP CALCULATION DEBUG ===');
                    
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

    } catch (error: any) {
        console.error('Error saving menu to sheet:', error);
        throw new Error(`Failed to save menu: ${error.message}`);
    }
};

/**
 * Get menu items from the Menu POS sheet for a specific butcher
 */
export const getMenuFromSheet = async (butcherId: string): Promise<MenuCategory[]> => {
    try {
        if (!MENU_POS_SHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID_MENU_POS not configured");
        }

        const sheets = await getButcherSheetsClient(butcherId);
        const tabName = BUTCHER_TABS[butcherId as keyof typeof BUTCHER_TABS];
        
        if (!tabName) {
            throw new Error(`No tab found for butcher: ${butcherId}`);
        }

        // Determine butcher type
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        
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
                
                // Handle empty size for meat items
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
 * Normalize item name for matching (handles case differences and spaces)
 */
const normalizeItemName = (name: string): string => {
    return name.toLowerCase().replace(/\s+/g, ' ').trim();
};

/**
 * Merge menu data from sheet with the full menu structure
 */
export const mergeMenuFromSheet = async (butcherId: string, fullMenu: MenuCategory[]): Promise<MenuCategory[]> => {
    try {
        const sheetMenu = await getMenuFromSheet(butcherId);
        
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
                const isFishButcher = ['kak', 'ka_sons', 'alif'].includes(butcherId);
                let searchName = item.name;
                
                if (isFishButcher && item.name.includes(' - ')) {
                    const nameParts = item.name.split(' - ');
                    if (nameParts.length >= 3) {
                        searchName = nameParts[1].trim(); // Extract English name
                    }
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
        const isMeatButcher = ['pkd', 'usaj', 'usaj_mutton'].includes(butcherId);
        
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
                size = 'default'; // Meat items don't have sizes
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

            console.log(`Looking up price for item: "${exactItemName}" (exact match) in ${butcherId}`);
            console.log(`Available menu price keys:`, Object.keys(menuPrices));
            console.log(`Direct lookup for "${exactItemName}":`, menuPrices[exactItemName]);

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
                console.warn(`⚠️ No purchase price found for ${item.name} (${exactItemName}) in ${butcherId} menu. Using default price 450.`);
                console.log(`Available menu prices for ${butcherId}:`, Object.keys(menuPrices));
                purchasePrice = 450; // Default price per kg
            }

            // Get commission rate for this item's category (load from Google Sheets)
            const itemCategory = item.category || 'default';
            const customRates = await getRatesFromSheet();
            const butcherCustomRates = customRates.find(r => r.butcherId === butcherId);
            const commissionRate = getCommissionRate(butcherId, itemCategory, butcherCustomRates?.commissionRates);

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
            const defaultPrice = 450;
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

// Legacy function for compatibility - redirects to new function
export const savePreparedOrderToSheet = async (order: Order, butcherId: string) => {
    return updateOrderInSheet(order, butcherId);
};

/**
 * Save commission and markup rates to Google Sheets
 */
export const saveRatesToSheet = async (butcherRates: ButcherRates[]): Promise<void> => {
    try {
        console.log('Starting to save rates to sheet...');
        console.log('Sheet ID:', BUTCHER_POS_SHEET_ID);
        console.log('Number of butchers:', butcherRates.length);
        
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        console.log('Getting Google Sheets client...');
        const sheets = await getSheetSheetsClient('pos');
        console.log('Google Sheets client obtained successfully');
        
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

        console.log('Prepared data rows:', dataRows.length);
        console.log('Sample data row:', dataRows[0]);

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
        console.log('=== LOADING RATES FROM GOOGLE SHEETS ===');
        if (!BUTCHER_POS_SHEET_ID) {
            throw new Error("BUTCHER_POS_SHEET_ID or GOOGLE_SPREADSHEET_ID not configured");
        }

        const sheets = await getSheetSheetsClient('pos');
        const ratesTabName = 'Rates';
        
        // Try to read from the Rates tab
        try {
            const range = `${ratesTabName}!A:F`;
            console.log('Attempting to read from range:', range);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: BUTCHER_POS_SHEET_ID,
                range,
            });

            const rows = response.data.values || [];
            console.log('Raw rows from sheet:', rows.length);
            console.log('First few rows:', rows.slice(0, 3));
            
            if (rows.length <= 1) {
                // No data or only header, return defaults
                console.log('No rates data found in sheet, returning defaults');
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

                console.log(`Parsing rates for ${butcherId}, category ${category}:`, {
                    commissionRateStr,
                    markupRateStr,
                    commissionRate,
                    markupRate,
                    finalMarkupRate
                });

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
            console.log(`Loaded rates for ${result.length} butchers from Google Sheets`);
            console.log('Loaded rates summary:', result.map(r => ({
                butcherId: r.butcherId,
                markupRates: r.markupRates
            })));
            console.log('=== END LOADING RATES FROM GOOGLE SHEETS ===');
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