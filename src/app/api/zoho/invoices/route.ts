import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';
import { getZohoCache } from '../../../../lib/zohoCache';
import { getZohoRateLimiter } from '../../../../lib/zohoRateLimiter';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const invoiceId = searchParams.get('invoice_id');
    const forceRefresh = searchParams.get('force') === 'true';

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

    const cache = getZohoCache();
    const rateLimiter = getZohoRateLimiter();

    if (invoiceId) {
      // Get specific invoice
      const cacheKey = `invoice:${invoiceId}`;
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = cache.getInvoiceDetails(invoiceId);
        if (cached) {
          return NextResponse.json({ invoice: cached });
        }
      }

      // Check rate limiter
      const { allowed, retryAfter } = rateLimiter.canMakeRequest();
      if (!allowed) {
        return NextResponse.json(
          { 
            error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
            retryAfter 
          },
          { status: 429 }
        );
      }

      // Use deduplication: if same request is in progress, wait for it
      const invoice = await cache.getOrCreatePendingRequest(
        cacheKey,
        async () => {
          rateLimiter.recordRequest();
          const zohoService = new ZohoService({
            organizationId,
            dataCenter,
            useBooksAuth: true,
          });
          const result = await zohoService.getInvoice(invoiceId);
          cache.setInvoiceDetails(invoiceId, result);
          return result;
        }
      );

      return NextResponse.json({ invoice });
    } else {
      // Get invoices by date
      const cacheKey = `invoices:${date}`;
      
      // Check cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = cache.getInvoices(date);
        if (cached) {
          return NextResponse.json({ invoices: cached });
        }
      }

      // Check rate limiter
      const { allowed, retryAfter } = rateLimiter.canMakeRequest();
      if (!allowed) {
        return NextResponse.json(
          { 
            error: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
            retryAfter 
          },
          { status: 429 }
        );
      }

      // Use deduplication: if same request is in progress, wait for it
      const invoices = await cache.getOrCreatePendingRequest(
        cacheKey,
        async () => {
          rateLimiter.recordRequest();
          const zohoService = new ZohoService({
            organizationId,
            dataCenter,
            useBooksAuth: true,
          });
          const result = await zohoService.getInvoicesByDate(date);
          cache.setInvoices(date, result);
          return result;
        }
      );

      return NextResponse.json({ invoices });
    }
  } catch (error) {
    console.error('Error in Zoho invoices API:', error);
    
    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch invoices';
    const isRateLimit = errorMessage.includes('429') || 
                       errorMessage.includes('rate limit') ||
                       errorMessage.includes('Rate limit exceeded');
    
    return NextResponse.json(
      { 
        error: errorMessage,
        isRateLimit 
      },
      { status: isRateLimit ? 429 : 500 }
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

