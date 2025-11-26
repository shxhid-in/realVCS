import { NextRequest, NextResponse } from 'next/server';
import { prepareOrder } from '@/lib/sheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order, butcherId } = body;

    if (!order || !butcherId) {
      return NextResponse.json(
        { error: 'Missing required fields: order, butcherId' },
        { status: 400 }
      );
    }

    console.log('Preparing order:', order.id, 'for butcher:', butcherId);
    
    const updatedOrder = await prepareOrder(order, butcherId);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Order prepared successfully',
      order: updatedOrder,
      revenue: updatedOrder.revenue,
      itemRevenues: updatedOrder.itemRevenues
    });
  } catch (error) {
    console.error('Error preparing order:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { 
        error: 'Failed to prepare order', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
