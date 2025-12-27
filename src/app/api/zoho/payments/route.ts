import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const all = searchParams.get('all') === 'true';

    const accountId = process.env.ZOHO_PAYMENTS_ACCOUNT_ID;
    const dataCenter = (process.env.ZOHO_DATA_CENTER as any) || 'com';

    // Check Zoho Payments credentials
    if (!process.env.ZOHO_PAYMENTS_CLIENT_ID || !process.env.ZOHO_PAYMENTS_CLIENT_SECRET || !process.env.ZOHO_PAYMENTS_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Zoho Payments credentials not configured. Please set ZOHO_PAYMENTS_CLIENT_ID, ZOHO_PAYMENTS_CLIENT_SECRET, and ZOHO_PAYMENTS_REFRESH_TOKEN' },
        { status: 500 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'ZOHO_PAYMENTS_ACCOUNT_ID not configured' },
        { status: 500 }
      );
    }

    // For Payments API, we still need organizationId for the service, but use Payments auth
    const zohoService = new ZohoService({
      organizationId: process.env.ZOHO_ORGANIZATION_ID || '', // Not used for Payments but required by interface
      accountId,
      dataCenter,
      useBooksAuth: false, // Use Payments auth
    });

    let payments;
    if (all) {
      payments = await zohoService.getAllPayments();
    } else if (date) {
      payments = await zohoService.getPaymentsByDate(date);
    } else {
      payments = await zohoService.getAllPayments();
    }

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error in Zoho payments API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

