import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';
import { getZohoAuth } from '../../../../lib/zohoAuth';

/**
 * Test endpoint to verify Zoho credentials and permissions
 * This helps diagnose authorization issues
 */
export async function GET(request: NextRequest) {
  try {
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

    const zohoAuth = getZohoAuth();
    const accessToken = await zohoAuth.getBooksAccessToken();

    // Test 1: Try to fetch organizations list (this should work if token is valid)
    // Since user has ZohoBooks scopes, use Books API
    const domain = dataCenter.replace('.', '_');
    const booksBaseUrl = `https://www.zohoapis.${dataCenter}/books/v3`;
    const invoiceBaseUrl = `https://www.zohoapis.${dataCenter}/invoice/v3`;
    
    const testResults: any = {
      credentials: {
        hasClientId: !!process.env.ZOHO_CLIENT_ID,
        hasClientSecret: !!process.env.ZOHO_CLIENT_SECRET,
        hasRefreshToken: !!process.env.ZOHO_REFRESH_TOKEN,
        organizationId: organizationId.substring(0, 3) + '...',
        dataCenter,
      },
      token: {
        hasAccessToken: !!accessToken,
        tokenLength: accessToken?.length || 0,
      },
      tests: [],
    };

    // Test 1: Fetch organizations from Books API (user has ZohoBooks scopes)
    try {
      const orgResponse = await fetch(`${booksBaseUrl}/organizations`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const orgData = await orgResponse.json();
      
      // Extract organization IDs for comparison
      const orgIds = orgData.organizations?.map((org: any) => org.organization_id) || [];
      const matchesEnvId = orgIds.includes(organizationId);
      
      testResults.tests.push({
        name: 'Fetch Organizations (Books API)',
        success: orgResponse.ok && orgData.code === 0,
        status: orgResponse.status,
        code: orgData.code,
        message: orgData.message || 'Unknown',
        organizations: orgData.organizations?.map((org: any) => ({
          id: org.organization_id,
          name: org.name,
          isDefault: org.is_default_org,
          matchesEnvId: org.organization_id === organizationId,
        })) || [],
        organizationIdMatch: {
          envId: organizationId,
          foundInList: matchesEnvId,
          availableIds: orgIds,
        },
        fullResponse: process.env.ZOHO_DEBUG === 'true' ? orgData : undefined,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Fetch Organizations (Books API)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Try Books API endpoint (user has ZohoBooks scopes)
    try {
      const invoiceResponse = await fetch(`${booksBaseUrl}/invoices?per_page=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          'X-com-zoho-books-organizationid': organizationId, // Books API header format
        },
      });

      const invoiceData = await invoiceResponse.json();
      
      testResults.tests.push({
        name: 'Books API - Fetch Invoices',
        success: invoiceResponse.ok && invoiceData.code !== 57,
        status: invoiceResponse.status,
        code: invoiceData.code,
        message: invoiceData.message || 'Unknown',
        orgHeaderKey: 'X-com-zoho-books-organizationid',
        invoiceCount: invoiceData.invoices?.length || 0,
        fullResponse: process.env.ZOHO_DEBUG === 'true' ? invoiceData : undefined,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Books API - Fetch Invoices',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: Try Books API with date filter
    try {
      const today = new Date().toISOString().split('T')[0];
      const invoiceResponse = await fetch(`${booksBaseUrl}/invoices?date=${today}&per_page=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json',
          'X-com-zoho-books-organizationid': organizationId,
        },
      });

      const invoiceData = await invoiceResponse.json();
      
      testResults.tests.push({
        name: 'Books API - Fetch Invoices (with date filter)',
        success: invoiceResponse.ok && invoiceData.code !== 57,
        status: invoiceResponse.status,
        code: invoiceData.code,
        message: invoiceData.message || 'Unknown',
        date: today,
        invoiceCount: invoiceData.invoices?.length || 0,
        fullResponse: process.env.ZOHO_DEBUG === 'true' ? invoiceData : undefined,
      });
    } catch (error) {
      testResults.tests.push({
        name: 'Books API - Fetch Invoices (with date filter)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return NextResponse.json(testResults);
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Test failed',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

