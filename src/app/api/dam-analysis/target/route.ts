import { NextRequest, NextResponse } from 'next/server';
import { getDAMTargetFromSheet, saveDAMTargetToSheet } from '@/lib/salesSheets';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || '1');
    const year = parseInt(searchParams.get('year') || new Date().getFullYear());

    const target = await getDAMTargetFromSheet(month, year);
    
    return NextResponse.json(target);
  } catch (error) {
    console.error('Error fetching DAM target:', error);
    return NextResponse.json(
      { error: 'Failed to fetch target data', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year, totalTarget } = body;

    if (!month || !year || !totalTarget) {
      return NextResponse.json(
        { error: 'Missing required fields: month, year, totalTarget' },
        { status: 400 }
      );
    }

    await saveDAMTargetToSheet(month, year, totalTarget);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving DAM target:', error);
    return NextResponse.json(
      { error: 'Failed to save target data' },
      { status: 500 }
    );
  }
}
