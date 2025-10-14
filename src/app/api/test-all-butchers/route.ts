import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/salesSheets';

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== TEST ALL BUTCHERS API ===');
    
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SALES_VCS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'SALES_VCS_SPREADSHEET_ID not found in environment variables' },
        { status: 400 }
      );
    }
    
    // Test all butcher tabs
    const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
    const butcherNames = {
      'usaj': 'Usaj_Meat_Hub',
      'usaj_mutton': 'Usaj_Mutton_Shop',
      'pkd': 'PKD_Stall',
      'kak': 'KAK',
      'ka_sons': 'KA_Sons',
      'alif': 'Alif'
    };
    
    const results = [];
    
    for (const butcherId of butcherIds) {
      const butcherName = butcherNames[butcherId as keyof typeof butcherNames];
      
      try {
        console.log(`Testing butcher: ${butcherId} -> ${butcherName}`);
        
        // Test if we can access the butcher's tab
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${butcherName}!A:J`,
        });
        
        const rows = response.data.values || [];
        console.log(`✅ Butcher ${butcherId} (${butcherName}): ${rows.length} rows found`);
        
        results.push({
          butcherId,
          butcherName,
          accessible: true,
          rowCount: rows.length,
          hasData: rows.length > 1, // More than just header
          sampleData: rows.slice(0, 3) // First 3 rows for debugging
        });
        
      } catch (error) {
        console.error(`❌ Butcher ${butcherId} (${butcherName}): Error accessing tab`, error);
        
        results.push({
          butcherId,
          butcherName,
          accessible: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'All butchers test completed',
      spreadsheetId,
      results
    });
    
  } catch (error) {
    console.error('Error in test all butchers API:', error);
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('\n=== TEST ALL BUTCHERS API - POST ===');
    
    const body = await request.json();
    const { butcherId, testData } = body;
    
    if (!butcherId) {
      return NextResponse.json(
        { error: 'Missing butcherId parameter' },
        { status: 400 }
      );
    }
    
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SALES_VCS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'SALES_VCS_SPREADSHEET_ID not found in environment variables' },
        { status: 400 }
      );
    }
    
    const butcherNames = {
      'usaj': 'Usaj_Meat_Hub',
      'usaj_mutton': 'Usaj_Mutton_Shop',
      'pkd': 'PKD_Stall',
      'kak': 'KAK',
      'ka_sons': 'KA_Sons',
      'alif': 'Alif'
    };
    
    const butcherName = butcherNames[butcherId as keyof typeof butcherNames];
    
    if (!butcherName) {
      return NextResponse.json(
        { error: `Unknown butcher ID: ${butcherId}` },
        { status: 400 }
      );
    }
    
    // Test data to append
    const testRowData = testData || [
      new Date().toLocaleDateString('en-IN'),
      `TEST-${Date.now()}`,
      'Test Item',
      '1',
      'Test Cut',
      '1.5',
      new Date().toLocaleTimeString('en-IN'),
      new Date().toLocaleTimeString('en-IN'),
      'completed',
      '100.00'
    ];
    
    console.log(`Testing data append for butcher: ${butcherId} -> ${butcherName}`);
    console.log('Test data:', testRowData);
    
    try {
      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${butcherName}!A:J`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [testRowData]
        }
      });
      
      console.log('✅ Test data appended successfully');
      console.log('Response:', appendResponse.data);
      
      return NextResponse.json({
        success: true,
        message: 'Test data appended successfully',
        butcherId,
        butcherName,
        testData: testRowData,
        response: appendResponse.data
      });
      
    } catch (error) {
      console.error('❌ Error appending test data:', error);
      
      return NextResponse.json({
        success: false,
        message: 'Failed to append test data',
        butcherId,
        butcherName,
        error: error instanceof Error ? error.message : String(error)
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in test all butchers API POST:', error);
    return NextResponse.json(
      { 
        error: 'Test failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
