import { NextRequest, NextResponse } from 'next/server';
import ZohoService from '../../../../lib/zohoService';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoice_id');

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'invoice_id is required' },
        { status: 400 }
      );
    }

    const accountId = process.env.ZOHO_PAYMENTS_ACCOUNT_ID;
    const dataCenter = (process.env.ZOHO_DATA_CENTER as any) || 'com';

    // Check Zoho Payments credentials
    if (!process.env.ZOHO_PAYMENTS_CLIENT_ID || !process.env.ZOHO_PAYMENTS_CLIENT_SECRET || !process.env.ZOHO_PAYMENTS_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Zoho Payments credentials not configured' },
        { status: 500 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'ZOHO_PAYMENTS_ACCOUNT_ID not configured' },
        { status: 500 }
      );
    }

    // Create service instances for both Books (invoices) and Payments
    const booksService = new ZohoService({
      organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
      accountId,
      dataCenter,
      useBooksAuth: true, // Use Books auth for invoices
    });

    const paymentsService = new ZohoService({
      organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
      accountId,
      dataCenter,
      useBooksAuth: false, // Use Payments auth for payment links
    });

    // Fetch invoice details for matching
    let invoice = null;
    try {
      invoice = await booksService.getInvoice(invoiceId);
    } catch {
      // Continue without invoice - matching will return empty array
    }

    // Zoho Payments API doesn't support listing all payment links
    // We need to use a different approach - get payments and infer payment links
    // OR try to get payment links from payments data if they contain payment link references
    
    // Get payments for the invoice date to check if any payments exist
    // Payments might contain payment link information
    let allPaymentLinks: any[] = [];
    
    if (invoice) {
      try {
        // Get ALL payments to match with invoice (not just by date)
        // This gives us better coverage for matching payment links
        const allPayments = await paymentsService.getAllPayments();
        
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] All payments for matching:', {
            totalPayments: allPayments.length,
            invoiceId,
            invoiceNumber: invoice.invoice_number,
            samplePayments: allPayments.slice(0, 3).map(p => ({
              id: p.payment_id,
              amount: p.amount,
              description: p.description,
              invoice_id: p.invoice_id,
              invoice_number: p.invoice_number
            }))
          });
        }
        
        // Match payments with invoice using order number matching
        const invoiceOrderNumber = ZohoService.extractOrderNumberFromInvoice(invoice);
        
        for (const payment of allPayments) {
          let shouldInclude = false;
          
          // Method 1: Direct invoice ID/number match
          if (payment.invoice_id === invoiceId || payment.invoice_number === invoice.invoice_number) {
            shouldInclude = true;
          }
          // Method 2: Order number matching from payment description
          else if (invoiceOrderNumber && payment.description) {
            const paymentOrderNumber = ZohoService.extractOrderNumberFromPayment(payment.description);
            if (paymentOrderNumber === invoiceOrderNumber) {
              // Also verify amount matches
              const amountDifference = Math.abs(payment.amount - invoice.total);
              if (amountDifference <= 0.01) {
                shouldInclude = true;
              }
            }
          }
          
          if (shouldInclude) {
            // Create a virtual payment link from payment data
            // This is a workaround since we can't list payment links via API
            const virtualLink = {
              payment_link_id: `payment_${payment.payment_id}`,
              invoice_id: invoiceId,
              amount: payment.amount,
              status: (payment.status === 'succeeded' || payment.status === 'paid') ? 'paid' : 'active' as const,
              payment_link_url: '', // We don't have this from payments
              created_time: payment.date,
              description: payment.description || '',
              reference_id: payment.reference_number || payment.payment_id
            };
            allPaymentLinks.push(virtualLink);
          }
        }
      } catch (error) {
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] Error getting payments for payment links:', error);
        }
      }
    }
    
    if (process.env.ZOHO_DEBUG === 'true') {
      console.log('[Zoho Debug] Payment Links (from payments):', {
        totalPaymentLinks: allPaymentLinks.length,
        invoiceId,
        hasInvoice: !!invoice,
        invoiceNumber: invoice?.invoice_number,
        samplePaymentLinks: allPaymentLinks.slice(0, 2).map(link => ({
          id: link.payment_link_id,
          description: link.description,
          amount: link.amount,
          status: link.status
        }))
      });
    }

    // If we have invoice, use matching logic
    let paymentLinks: any[] = [];
    if (invoice) {
      // Since we're getting payment links from payments, we can match by invoice_id directly
      // But also try order number matching for additional validation
      paymentLinks = allPaymentLinks.filter(link => {
        // Direct invoice match
        if (link.invoice_id === invoiceId) {
          return true;
        }
        // Order number matching for additional validation
        const invoiceOrderNumber = ZohoService.extractOrderNumberFromInvoice(invoice);
        if (invoiceOrderNumber && link.description) {
          const linkOrderNumber = ZohoService.extractOrderNumberFromPaymentLink(link.description);
          if (linkOrderNumber === invoiceOrderNumber) {
            // Also check amount match
            const amountDifference = Math.abs(link.amount - invoice.total);
            return amountDifference <= 0.01;
          }
        }
        return false;
      });
      
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Matched Payment Links:', {
          invoiceNumber: invoice.invoice_number,
          matchedCount: paymentLinks.length,
          paymentLinks: paymentLinks.map(link => ({
            id: link.payment_link_id,
            amount: link.amount,
            status: link.status,
            description: link.description
          })),
          invoiceOrderNumber: ZohoService.extractOrderNumberFromInvoice(invoice)
        });
      }
    } else {
      // If no invoice found, return empty array
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Invoice not found for invoice_id:', invoiceId);
      }
      paymentLinks = [];
    }

    return NextResponse.json({ payment_links: paymentLinks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch payment links' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoice_id, amount, description, customer_id, expiry_days } = body;

    if (!amount) {
      return NextResponse.json(
        { error: 'amount is required' },
        { status: 400 }
      );
    }

    const accountId = process.env.ZOHO_PAYMENTS_ACCOUNT_ID;
    const dataCenter = (process.env.ZOHO_DATA_CENTER as any) || 'com';

    // Check Zoho Payments credentials
    if (!process.env.ZOHO_PAYMENTS_CLIENT_ID || !process.env.ZOHO_PAYMENTS_CLIENT_SECRET || !process.env.ZOHO_PAYMENTS_REFRESH_TOKEN) {
      return NextResponse.json(
        { error: 'Zoho Payments credentials not configured' },
        { status: 500 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'ZOHO_PAYMENTS_ACCOUNT_ID not configured' },
        { status: 500 }
      );
    }

    const zohoService = new ZohoService({
      organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
      accountId,
      dataCenter,
      useBooksAuth: false, // Use Payments auth
    });

    const paymentLink = await zohoService.createPaymentLink({
      invoice_id,
      amount,
      description,
      customer_id,
      expiry_days,
    });

    return NextResponse.json({ payment_link: paymentLink });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment link' },
      { status: 500 }
    );
  }
}

