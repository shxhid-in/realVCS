import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

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

    const contacts = await zohoService.getContacts(search);
    return NextResponse.json({ contacts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

