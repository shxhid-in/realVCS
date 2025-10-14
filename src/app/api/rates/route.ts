import { NextRequest, NextResponse } from 'next/server';
import { saveRatesToSheet, getRatesFromSheet } from '../../../lib/sheets';
import type { ButcherRates } from '../../../lib/types';

export async function GET() {
  try {
    const rates = await getRatesFromSheet();
    return NextResponse.json({ rates });
  } catch (error) {
    console.error('Error fetching rates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rates' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rates }: { rates: ButcherRates[] } = body;

    if (!rates || !Array.isArray(rates)) {
      return NextResponse.json(
        { error: 'Invalid rates data' },
        { status: 400 }
      );
    }

    await saveRatesToSheet(rates);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Rates saved successfully' 
    });
  } catch (error) {
    console.error('Error saving rates:', error);
    return NextResponse.json(
      { error: 'Failed to save rates' },
      { status: 500 }
    );
  }
}
