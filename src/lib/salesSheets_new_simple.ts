import { google } from 'googleapis';

// Get Google Sheets client for sales operations
export const getSheetsClient = async () => {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google credentials in environment variables");
  }
  
  // Clean up the private key format
  let cleanPrivateKey = privateKey
    .replace(/\\n/g, '\n')
    .replace(/"/g, '')
    .trim();
  
  if (!cleanPrivateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    cleanPrivateKey = `-----BEGIN PRIVATE KEY-----\n${cleanPrivateKey}\n-----END PRIVATE KEY-----`;
  }
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail.replace(/"/g, ''),
      private_key: cleanPrivateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client as any });
};

// Get butcher name by ID (matching Sales VCS sheet tab names)
const getButcherName = (butcherId: string): string => {
  const butcherNames: { [key: string]: string } = {
    'usaj': 'Usaj',
    'usaj_mutton': 'Usaj Mutton Shop',
    'pkd': 'PKD',
    'kak': 'KAK',
    'ka_sons': 'KA Sons',
    'alif': 'Alif'
  };
  return butcherNames[butcherId] || butcherId;
};

// Get selling price from menu sheet for an item
export const getSellingPriceFromMenu = async (
  butcherId: string,
  itemName: string
): Promise<number> => {
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
    
    // Get butcher name for menu sheet
    const butcherNames: { [key: string]: string } = {
      'usaj': 'Usaj',
      'usaj_mutton': 'Usaj Mutton Shop',
      'pkd': 'PKD',
      'kak': 'KAK',
      'ka_sons': 'KA Sons',
      'alif': 'Alif'
    };
    const menuButcherName = butcherNames[butcherId] || butcherId;
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${menuButcherName}!A:${rangeEnd}`,
    });

    const rows = response.data.values || [];
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length > sellingPriceColumn) {
        const menuItemName = row[0]?.toString().trim();
        const sellingPrice = parseFloat(row[sellingPriceColumn]) || 0;
        
        // Try exact match first, then case-insensitive match
        if (menuItemName === itemName || menuItemName?.toLowerCase() === itemName.toLowerCase()) {
          return sellingPrice;
        }
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting selling price from menu:', error);
    return 0;
  }
};

// Save sales data to Sales VCS sheet
export const saveSalesDataToSheet = async (
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

  // Get Google Sheets client
  const sheets = await getSheetsClient();
  
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

  for (const item of orderData.items) {
    const itemName = item.name;
    const preparingWeight = parseFloat(
      orderData.itemQuantities?.[itemName] || 
      orderData.itemWeights?.[itemName] || 
      item.quantity
    );

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
