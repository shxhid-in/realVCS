import { NextRequest, NextResponse } from 'next/server';
import { saveSalesDataToSheet } from '@/lib/salesSheets';

export async function POST(request: NextRequest) {
  try {
    console.log('\n=== TEST SALES UPLOAD API ===');
    
    const body = await request.json();
    const { orderId, butcherId, orderData } = body;

    console.log('Test data received:', { orderId, butcherId, orderDataKeys: Object.keys(orderData || {}) });

    // Test the sales data upload
    await saveSalesDataToSheet(orderId, butcherId, orderData);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test sales data upload completed successfully',
      data: {
        orderId,
        butcherId,
        orderStatus: orderData?.status,
        itemCount: orderData?.items?.length || 0
      }
    });
  } catch (error) {
    console.error('Error in test sales upload API:', error);
    return NextResponse.json(
      { 
        error: 'Test sales data upload failed', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== TEST SALES UPLOAD API - GET ===');
    
    // Test environment variables
    const envCheck = {
      hasGoogleSheetsClientEmail: !!process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      hasGoogleSheetsPrivateKey: !!process.env.GOOGLE_SHEETS_PRIVATE_KEY,
      hasSalesVcsSpreadsheetId: !!process.env.SALES_VCS_SPREADSHEET_ID,
      salesVcsSpreadsheetId: process.env.SALES_VCS_SPREADSHEET_ID,
      googleSheetsClientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.substring(0, 20) + '...'
    };
    
    console.log('Environment check:', envCheck);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Environment variables check completed',
      environment: envCheck
    });
  } catch (error) {
    console.error('Error in test sales upload API GET:', error);
    return NextResponse.json(
      { 
        error: 'Environment check failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
