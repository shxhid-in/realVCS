import { NextRequest, NextResponse } from 'next/server';
import { saveSalesDataToSheet } from '@/lib/salesSheets';

export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json();
    
    const { orderId, butcherId, orderData } = body;


    if (!orderId || !butcherId || !orderData) {
      console.error('Missing required fields:', { orderId: !!orderId, butcherId: !!butcherId, orderData: !!orderData });
      return NextResponse.json(
        { error: 'Missing required fields: orderId, butcherId, orderData' },
        { status: 400 }
      );
    }

    await saveSalesDataToSheet(orderId, butcherId, orderData);
    
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
