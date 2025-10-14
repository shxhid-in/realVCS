import { NextRequest, NextResponse } from 'next/server';
import { saveSalesDataToSheetSimple } from '@/lib/salesSheets';

export async function POST(request: NextRequest) {
  console.log('\n=== SALES DATA API CALLED ===');
  console.log('Request URL:', request.url);
  console.log('Request method:', request.method);
  
  try {
    console.log('Attempting to parse request body...');
    const body = await request.json();
    console.log('Raw body received:', JSON.stringify(body, null, 2));
    
    const { orderId, butcherId, orderData } = body;

    console.log('API received data:', { 
      orderId, 
      butcherId, 
      orderDataKeys: Object.keys(orderData || {}),
      orderDataItems: orderData?.items?.length || 0,
      orderDataStatus: orderData?.status
    });

    if (!orderId || !butcherId || !orderData) {
      console.error('Missing required fields:', { orderId: !!orderId, butcherId: !!butcherId, orderData: !!orderData });
      return NextResponse.json(
        { error: 'Missing required fields: orderId, butcherId, orderData' },
        { status: 400 }
      );
    }

    console.log('Calling saveSalesDataToSheetSimple...');
    await saveSalesDataToSheetSimple(orderId, butcherId, orderData);
    console.log('saveSalesDataToSheetSimple completed successfully');
    
    return NextResponse.json({ success: true, message: 'Sales data saved successfully' });
  } catch (error) {
    console.error('Error in sales data API:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      type: typeof error
    });
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Ensure we always return a proper JSON response
    try {
      return NextResponse.json(
        { 
          error: 'Failed to save sales data', 
          details: errorMessage,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    } catch (responseError) {
      console.error('Failed to create error response:', responseError);
      // Fallback: return a simple text response
      return new Response(
        `Error: ${errorMessage}`,
        { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }
  }
}
