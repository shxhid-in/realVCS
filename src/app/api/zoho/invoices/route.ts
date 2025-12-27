import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const invoiceId = searchParams.get('invoice_id');

    // Get Zoho Books/Invoice credentials from environment
    const organizationId = process.env.ZOHO_ORGANIZATION_ID;
    const dataCenter = (process.env.ZOHO_DATA_CENTER as any) || 'com';

    // Check required credentials
    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Zoho Books credentials not configured. Please set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN' },
        { status: 500 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'ZOHO_ORGANIZATION_ID not configured' },
        { status: 500 }
      );
    }

    const zohoService = new ZohoService({
      organizationId,
      dataCenter,
      useBooksAuth: true, // Use Books auth for Invoice API
    });

    if (invoiceId) {
      // Get specific invoice
      const invoice = await zohoService.getInvoice(invoiceId);
      return NextResponse.json({ invoice });
    } else {
      // Get invoices by date
      const invoices = await zohoService.getInvoicesByDate(date);
      return NextResponse.json({ invoices });
    }
  } catch (error) {
    console.error('Error in Zoho invoices API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoice_id');

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      );
    }

    const updates = await request.json();

    const organizationId = process.env.ZOHO_ORGANIZATION_ID;
    const dataCenter = (process.env.ZOHO_DATA_CENTER as any) || 'com';

    if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET || !process.env.ZOHO_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Zoho Books credentials not configured' },
        { status: 500 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'ZOHO_ORGANIZATION_ID not configured' },
        { status: 500 }
      );
    }

    const zohoService = new ZohoService({
      organizationId,
      dataCenter,
      useBooksAuth: true,
    });

    const updatedInvoice = await zohoService.updateInvoice(invoiceId, updates);
    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update invoice' },
      { status: 500 }
    );
  }
}

