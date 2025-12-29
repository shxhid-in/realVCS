import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';
import { getZohoCache } from '../../../../lib/zohoCache';
import { getZohoRateLimiter } from '../../../../lib/zohoRateLimiter';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const all = searchParams.get('all') === 'true';
    const forceRefresh = searchParams.get('force') === 'true';

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

    const cache = getZohoCache();
    const rateLimiter = getZohoRateLimiter();

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = cache.getPayments(date, all);
      if (cached) {
        return NextResponse.json({ payments: cached });
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
    const cacheKey = `payments:${date || 'all'}:${all ? 'all' : 'date'}`;
    const payments = await cache.getOrCreatePendingRequest(
      cacheKey,
      async () => {
        rateLimiter.recordRequest();
        const zohoService = new ZohoService({
          organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
          accountId,
          dataCenter,
          useBooksAuth: false,
        });

        let result;
        if (all) {
          result = await zohoService.getAllPayments();
        } else if (date) {
          result = await zohoService.getPaymentsByDate(date);
        } else {
          result = await zohoService.getAllPayments();
        }

        cache.setPayments(date, all, result);
        return result;
      }
    );

    return NextResponse.json({ payments });
  } catch (error) {
    console.error('Error in Zoho payments API:', error);
    
    // Check if it's a rate limit error
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch payments';
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

