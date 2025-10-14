import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/salesSheets';

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== TESTING SALES VCS SHEET CONNECTION ===');
    
    // Check environment variables
    const salesSpreadsheetId = process.env.SALES_VCS_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    
    console.log('Environment variables check:');
    console.log('- SALES_VCS_SPREADSHEET_ID:', salesSpreadsheetId ? 'SET' : 'NOT SET');
    console.log('- GOOGLE_SHEETS_CLIENT_EMAIL:', clientEmail ? 'SET' : 'NOT SET');
    console.log('- GOOGLE_SHEETS_PRIVATE_KEY:', privateKey ? 'SET' : 'NOT SET');
    
    if (!salesSpreadsheetId) {
      return NextResponse.json({
        success: false,
        error: 'SALES_VCS_SPREADSHEET_ID environment variable not set',
        envVars: {
          salesSpreadsheetId: !!salesSpreadsheetId,
          clientEmail: !!clientEmail,
          privateKey: !!privateKey
        }
      });
    }
    
    // Test Google Sheets connection
    const sheets = await getSheetsClient();
    
    // Try to read from the spreadsheet to test connection
    const response = await sheets.spreadsheets.get({
      spreadsheetId: salesSpreadsheetId
    });
    
    console.log('Spreadsheet info:', {
      title: response.data.properties?.title,
      sheetCount: response.data.sheets?.length
    });
    
    return NextResponse.json({
      success: true,
      message: 'Sales VCS sheet connection successful',
      spreadsheetInfo: {
        title: response.data.properties?.title,
        sheetCount: response.data.sheets?.length,
        sheetNames: response.data.sheets?.map(sheet => sheet.properties?.title)
      }
    });
    
  } catch (error) {
    console.error('Error testing Sales VCS sheet connection:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}
