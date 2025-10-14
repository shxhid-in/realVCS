import { NextRequest, NextResponse } from 'next/server';
import { getMenuFromSheet, saveMenuToSheet } from '../../../../lib/sheets';
import type { MenuCategory } from '../../../../lib/types';

// GET /api/menu/[butcherId] - Get menu for a butcher
export async function GET(
  request: NextRequest,
  { params }: { params: { butcherId: string } }
) {
  try {
    const { butcherId } = params;
    
    if (!butcherId) {
      return NextResponse.json({ error: 'Butcher ID is required' }, { status: 400 });
    }

    const menu = await getMenuFromSheet(butcherId);
    return NextResponse.json({ menu });
    
  } catch (error: any) {
    console.error('Error fetching menu:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/menu/[butcherId] - Save menu for a butcher
export async function POST(
  request: NextRequest,
  { params }: { params: { butcherId: string } }
) {
  try {
    const { butcherId } = params;
    const { menu }: { menu: MenuCategory[] } = await request.json();
    
    if (!butcherId || !menu) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    await saveMenuToSheet(butcherId, menu);
    return NextResponse.json({ success: true, message: 'Menu saved successfully' });
    
  } catch (error: any) {
    console.error('Error saving menu:', error);
    return NextResponse.json(
      { error: 'Failed to save menu', details: error.message },
      { status: 500 }
    );
  }
}
