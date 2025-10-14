import { NextRequest, NextResponse } from 'next/server';
import { getSellingPriceFromMenu } from '@/lib/salesSheets';

export async function POST(request: NextRequest) {
  try {
    console.log('\n=== TEST ITEM MATCHING API ===');
    
    const body = await request.json();
    const { butcherId, itemName } = body;

    console.log('Testing item matching for:', { butcherId, itemName });

    // Test the selling price lookup
    const sellingPrice = await getSellingPriceFromMenu(butcherId, itemName);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Item matching test completed',
      data: {
        butcherId,
        itemName,
        sellingPrice,
        found: sellingPrice > 0
      }
    });
  } catch (error) {
    console.error('Error in test item matching API:', error);
    return NextResponse.json(
      { 
        error: 'Item matching test failed', 
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('\n=== TEST ITEM MATCHING API - GET ===');
    
    const url = new URL(request.url);
    const butcherId = url.searchParams.get('butcherId');
    const itemName = url.searchParams.get('itemName');
    
    if (!butcherId || !itemName) {
      return NextResponse.json(
        { error: 'Missing butcherId or itemName parameters' },
        { status: 400 }
      );
    }
    
    console.log('Testing item matching for:', { butcherId, itemName });

    // Test the selling price lookup
    const sellingPrice = await getSellingPriceFromMenu(butcherId, itemName);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Item matching test completed',
      data: {
        butcherId,
        itemName,
        sellingPrice,
        found: sellingPrice > 0
      }
    });
  } catch (error) {
    console.error('Error in test item matching API GET:', error);
    return NextResponse.json(
      { 
        error: 'Item matching test failed', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
