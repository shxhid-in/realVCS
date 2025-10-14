import { NextRequest, NextResponse } from 'next/server';
import { getItemPurchasePricesFromSheet } from '../../../../lib/sheets';

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

const getCached = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCached = (key: string, data: any, ttl: number = 30000) => {
  cache.set(key, { data, timestamp: Date.now(), ttl });
};

// GET /api/purchase-prices/[butcherId] - Get purchase prices for items from Menu POS sheet
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ butcherId: string }> }
) {
  try {
    const { butcherId } = await params;
    
    if (!butcherId) {
      return NextResponse.json({ error: 'Butcher ID is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `purchase_prices_${butcherId}`;
    const cachedPrices = getCached(cacheKey);
    if (cachedPrices) {
      return NextResponse.json({ prices: cachedPrices });
    }

    const url = new URL(request.url);
    const itemNames = url.searchParams.get('items')?.split(',') || [];
    const orderItemsParam = url.searchParams.get('orderItems');
    
    if (itemNames.length === 0) {
      return NextResponse.json({ error: 'No items specified' }, { status: 400 });
    }

    // Parse order items if provided
    let orderItems = undefined;
    if (orderItemsParam) {
      try {
        orderItems = JSON.parse(decodeURIComponent(orderItemsParam));
      } catch (error) {
      }
    }

    const prices = await getItemPurchasePricesFromSheet(butcherId, itemNames, orderItems);
    
    // Cache for 30 seconds to reduce API calls
    setCached(cacheKey, prices, 30000);
    
    return NextResponse.json({ prices });
    
  } catch (error: any) {
    
    // Return specific error for quota exceeded
    if (error.status === 429 || error.message?.includes('Quota exceeded')) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch purchase prices', details: error.message },
      { status: 500 }
    );
  }
}
