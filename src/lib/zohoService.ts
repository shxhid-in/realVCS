/**
 * Zoho Invoice & Payments API Service
 * Handles all Zoho API interactions for invoices and payments
 */

import { getZohoAuth } from './zohoAuth';

interface ZohoConfig {
  organizationId: string;
  accountId?: string; // For Payments API
  dataCenter?: 'com' | 'eu' | 'in' | 'com.au' | 'jp' | 'ca' | 'com.cn' | 'sa';
  useBooksAuth?: boolean; // Use Books auth (true) or Payments auth (false)
}

interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  contact_persons?: Array<{ contact_person_id: string; phone?: string; mobile?: string }>;
  phone?: string;
  date: string;
  due_date?: string;
  status: string;
  total: number;
  balance: number;
  line_items: Array<{
    item_id?: string;
    name: string;
    description?: string;
    quantity: number;
    unit?: string;
    rate: number;
    item_total: number;
  }>;
  custom_fields?: Array<{ customfield_id: string; value: string }>;
  description?: string;
  notes?: string;
  terms?: string;
}

interface ZohoPayment {
  payment_id: string;
  payment_number: string;
  invoice_id?: string;
  invoice_number?: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  date: string | number; // Can be ISO string or timestamp
  payment_mode?: string;
  payment_method?: string | { name?: string; type?: string; method?: string; label?: string; [key: string]: any }; // Can be string or object
  method?: string | { name?: string; type?: string; method?: string; label?: string; [key: string]: any }; // Can be string or object
  description?: string;
  reference_number?: string;
  status: string;
}

interface ZohoPaymentLink {
  payment_link_id: string;
  invoice_id?: string;
  amount: number;
  status: 'active' | 'paid' | 'expired' | 'cancelled';
  payment_link_url: string;
  created_time: string;
  expiry_time?: string;
  description?: string; // Payment link description (format: DDMMYYNNN)
  reference_id?: string; // Reference ID for matching
}

class ZohoService {
  private config: ZohoConfig;
  private invoiceBaseUrl: string;
  private paymentsBaseUrl: string;
  private zohoAuth = getZohoAuth();

  constructor(config: ZohoConfig) {
    this.config = config;
    const domain = this.getDomain(config.dataCenter || 'com');
    // Use Books API since user has ZohoBooks scopes
    // Books API: /books/v3/invoices (uses ZohoBooks.* scopes)
    // Invoice API: /invoice/v3/invoices (uses ZohoInvoice.* scopes)
    this.invoiceBaseUrl = `https://www.zohoapis.${domain}/books/v3`;
    // Zoho Payments API uses a different base URL: https://payments.zoho.{domain}/api/v1
    // account_id is passed as a query parameter, not in the path
    this.paymentsBaseUrl = `https://payments.zoho.${domain}/api/v1`;
  }

  private getDomain(dataCenter: string): string {
    const domainMap: Record<string, string> = {
      'com': 'com',
      'eu': 'eu',
      'in': 'in',
      'com.au': 'com.au',
      'jp': 'jp',
      'ca': 'ca',
      'com.cn': 'com.cn',
      'sa': 'sa'
    };
    return domainMap[dataCenter] || 'com';
  }

  private async makeRequest(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ): Promise<any> {
    // Determine which auth to use based on URL or config
    // Payments API URLs include '/payments/', Books/Invoice API URLs include '/books/' or '/invoice/'
    const isPaymentsApi = url.includes('/payments/');
    const isBooksApi = url.includes('/books/') || url.includes('/invoice/');
    
    // Use Payments auth if: URL is Payments API OR config explicitly says use Payments auth
    // Use Books auth if: URL is Books/Invoice API OR config doesn't explicitly say use Payments auth
    const useBooksAuth = isBooksApi || (!isPaymentsApi && this.config.useBooksAuth !== false);
    
    const accessToken = useBooksAuth
      ? await this.zohoAuth.getBooksAccessToken()
      : await this.zohoAuth.getPaymentsAccessToken();

    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // Set organization ID header - Books API uses different header format
    if (url.includes('/books/') || url.includes('/invoice/')) {
      const dataCenter = this.config.dataCenter || 'com';
      
      // Zoho Books API header format: X-com-zoho-books-organizationid (always 'com' regardless of data center)
      // Zoho Invoice API header format: X-{dataCenter}-zoho-invoice-organizationid
      
      if (url.includes('/books/')) {
        // Books API - always use 'com' in header regardless of data center
        headers['X-com-zoho-books-organizationid'] = this.config.organizationId;
        
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] Using Books API header:', {
            header: 'X-com-zoho-books-organizationid',
            organizationId: this.config.organizationId ? `${this.config.organizationId.substring(0, 3)}...` : 'missing',
          });
        }
      } else if (url.includes('/invoice/')) {
        // Invoice API - use data center specific header
        let orgHeaderKey: string;
        
        if (dataCenter === 'com') {
          orgHeaderKey = 'X-com-zoho-invoice-organizationid';
        } else if (dataCenter === 'in') {
          orgHeaderKey = 'X-in-zoho-invoice-organizationid';
        } else if (dataCenter === 'eu') {
          orgHeaderKey = 'X-eu-zoho-invoice-organizationid';
        } else {
          const headerDataCenter = dataCenter.replace('.', '_');
          orgHeaderKey = `X-${headerDataCenter}-zoho-invoice-organizationid`;
        }
        
        headers[orgHeaderKey] = this.config.organizationId;
        
        // For India, also try 'com' format
        if (dataCenter === 'in') {
          headers['X-com-zoho-invoice-organizationid'] = this.config.organizationId;
        }
      }
      
      // Debug logging is handled within each branch above
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      // Zoho Invoice API expects form-data for POST/PUT
      if (url.includes('/invoice/') && (method === 'POST' || method === 'PUT')) {
        const formData = new FormData();
        formData.append('JSONString', JSON.stringify(body));
        options.body = formData;
        delete headers['Content-Type']; // Let browser set Content-Type with boundary
      } else {
        options.body = JSON.stringify(body);
      }
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        // Try to get detailed error information
        let errorData: any = {};
        let errorText = '';
        
        try {
          errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch {
          // If parsing fails, use the text as error message
          errorData = { message: errorText || response.statusText };
        }

        // Enhanced error logging (only in debug mode)
        if (process.env.ZOHO_DEBUG === 'true') {
          console.error('[Zoho Debug] API Error Response:', {
            status: response.status,
            statusText: response.statusText,
            url,
            errorData,
            headers: Object.fromEntries(response.headers.entries()),
          });
        }

        // Extract error message from Zoho response format
        const errorMessage = errorData.message || 
                           errorData.error_description || 
                           errorData.error || 
                           `Zoho API error: ${response.status} ${response.statusText}`;
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Handle Zoho API response format
      if (data.code !== undefined && data.code !== 0) {
        const errorMessage = data.message || `Zoho API error (code: ${data.code})`;
        
        if (process.env.ZOHO_DEBUG === 'true') {
          console.error('[Zoho Debug] Zoho API Error Code:', {
            code: data.code,
            message: data.message,
            url,
          });
        }
        
        throw new Error(errorMessage);
      }

      return data;
    } catch (error) {
      // Only log to console in debug mode
      if (process.env.ZOHO_DEBUG === 'true') {
        console.error('[Zoho Debug] Request failed:', error);
      }
      throw error;
    }
  }

  /**
   * Get list of organizations (useful for testing and verifying organization ID)
   */
  async getOrganizations(): Promise<any[]> {
    try {
      // Books API organizations endpoint
      const url = `${this.invoiceBaseUrl}/organizations`;
      const response = await this.makeRequest(url);
      return response.organizations || [];
    } catch (error) {
      if (process.env.ZOHO_DEBUG === 'true') {
        console.error('[Zoho Debug] Error fetching organizations:', error);
      }
      throw error;
    }
  }

  /**
   * Get invoices for a specific date
   */
  async getInvoicesByDate(date: string): Promise<ZohoInvoice[]> {
    try {
      // Format date as YYYY-MM-DD
      const dateObj = new Date(date);
      const formattedDate = dateObj.toISOString().split('T')[0];
      
      // Validate date is not in the future
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (dateObj > today) {
        if (process.env.ZOHO_DEBUG === 'true') {
          console.warn('[Zoho Debug] Warning: Requesting invoices for future date:', formattedDate);
        }
        // Still proceed, but log warning
      }
      
      // Books API endpoint with date filter
      // Books API uses: /books/v3/invoices?date=YYYY-MM-DD
      const url = `${this.invoiceBaseUrl}/invoices?date=${formattedDate}&per_page=200`;
      const response = await this.makeRequest(url);
      
      // Handle different response formats
      if (response.invoices) {
        return response.invoices;
      } else if (Array.isArray(response)) {
        return response;
      } else {
        return [];
      }
    } catch (error) {
      if (process.env.ZOHO_DEBUG === 'true') {
        console.error('[Zoho Debug] Error fetching invoices:', error);
      }
      throw error;
    }
  }

  /**
   * Get a specific invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<ZohoInvoice> {
    try {
      const url = `${this.invoiceBaseUrl}/invoices/${invoiceId}`;
      const response = await this.makeRequest(url);
      return response.invoice;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }

  /**
   * Update an invoice
   */
  async updateInvoice(invoiceId: string, updates: Partial<ZohoInvoice>): Promise<ZohoInvoice> {
    try {
      const url = `${this.invoiceBaseUrl}/invoices/${invoiceId}`;
      const response = await this.makeRequest(url, 'PUT', updates);
      return response.invoice;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  /**
   * Get payments for a date range
   * Note: Zoho Payments API doesn't support date filtering via query parameters
   * We fetch all payments and filter by date client-side
   */
  async getPaymentsByDate(date: string): Promise<ZohoPayment[]> {
    try {
      if (!this.config.accountId) {
        throw new Error('Account ID is required for fetching payments');
      }
      
      // Fetch all payments (Zoho Payments API doesn't support date parameter)
      const url = `${this.paymentsBaseUrl}/payments?account_id=${this.config.accountId}`;
      const response = await this.makeRequest(url);
      const allPayments = response.payments || [];
      
      if (process.env.ZOHO_DEBUG === 'true' && allPayments.length > 0) {
        console.log('[Zoho Debug] Sample payment structure:', {
          firstPayment: allPayments[0],
          allKeys: Object.keys(allPayments[0] || {}),
          dateField: allPayments[0]?.date,
          dateFieldType: typeof allPayments[0]?.date
        });
      }
      
      // Filter payments by date client-side
      const targetDate = new Date(date).toISOString().split('T')[0];
      const targetDateObj = new Date(date);
      targetDateObj.setHours(0, 0, 0, 0);
      
      const filteredPayments = allPayments.filter((payment: ZohoPayment) => {
        if (!payment.date) return false;
        
        // Handle different date formats
        let paymentDateObj: Date;
        try {
          // Try parsing as ISO string or timestamp
          if (typeof payment.date === 'string') {
            // Check if it's a timestamp (number as string)
            if (/^\d+$/.test(payment.date)) {
              paymentDateObj = new Date(parseInt(payment.date) * 1000); // Convert seconds to milliseconds
            } else {
              paymentDateObj = new Date(payment.date);
            }
          } else if (typeof payment.date === 'number') {
            // If it's already a number, might be timestamp in seconds or milliseconds
            paymentDateObj = payment.date > 1000000000000 
              ? new Date(payment.date) // milliseconds
              : new Date(payment.date * 1000); // seconds
          } else {
            return false;
          }
          
          // Reset time to compare dates only
          paymentDateObj.setHours(0, 0, 0, 0);
          
          return paymentDateObj.getTime() === targetDateObj.getTime();
        } catch (error) {
          if (process.env.ZOHO_DEBUG === 'true') {
            console.log('[Zoho Debug] Error parsing payment date:', payment.date, error);
          }
          return false;
        }
      });
      
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Payments filtered by date:', {
          targetDate,
          totalPayments: allPayments.length,
          filteredCount: filteredPayments.length,
          samplePaymentDates: allPayments.slice(0, 3).map((p: ZohoPayment) => ({
            date: p.date,
            dateType: typeof p.date,
            parsed: new Date(p.date).toISOString().split('T')[0]
          }))
        });
      }
      
      return filteredPayments;
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  /**
   * Get all payments (to match with invoices)
   * Note: Zoho Payments API may not support per_page parameter
   */
  async getAllPayments(): Promise<ZohoPayment[]> {
    try {
      if (!this.config.accountId) {
        throw new Error('Account ID is required for fetching payments');
      }
      
      // Try without per_page first (Zoho Payments API may not support it)
      let url = `${this.paymentsBaseUrl}/payments?account_id=${this.config.accountId}`;
      
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Fetching all payments:', url);
      }
      
      try {
        const response = await this.makeRequest(url);
        return response.payments || [];
      } catch (error: any) {
        // If it fails, try with per_page (though it might not be supported)
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] Payments fetch failed, trying with per_page:', error.message);
        }
        
        url = `${this.paymentsBaseUrl}/payments?account_id=${this.config.accountId}&per_page=200`;
        const response2 = await this.makeRequest(url);
        return response2.payments || [];
      }
    } catch (error) {
      console.error('Error fetching all payments:', error);
      throw error;
    }
  }

  /**
   * Create a payment link
   */
  async createPaymentLink(params: {
    invoice_id?: string;
    amount: number;
    description?: string;
    customer_id?: string;
    expiry_days?: number;
  }): Promise<ZohoPaymentLink> {
    try {
      if (!this.config.accountId) {
        throw new Error('Account ID is required for creating payment links');
      }

      // Zoho Payments API: account_id is a query parameter, not in the path
      const url = `${this.paymentsBaseUrl}/paymentlinks?account_id=${this.config.accountId}`;
      const body = {
        ...params,
        // Store invoice_id in reference_id for future matching
        // Since we can't query payment links by invoice_id, we use reference_id
        // to identify which invoice this payment link belongs to
        reference_id: params.invoice_id || params.reference_id || undefined
      };
      
      // Force use Payments auth for payment links
      const useBooksAuth = this.config.useBooksAuth;
      this.config.useBooksAuth = false;
      
      try {
        const response = await this.makeRequest(url, 'POST', body);
        return response.payment_link;
      } finally {
        this.config.useBooksAuth = useBooksAuth;
      }
    } catch (error) {
      console.error('Error creating payment link:', error);
      throw error;
    }
  }

  /**
   * Get payment links for an invoice by matching order numbers
   * Note: Zoho Payments API doesn't support filtering payment links by invoice_id.
   * This method matches payment links using order number from description and amount.
   */
  async getPaymentLinks(invoiceId: string, invoice?: ZohoInvoice): Promise<ZohoPaymentLink[]> {
    try {
      if (!this.config.accountId) {
        throw new Error('Account ID is required for fetching payment links');
      }
      
      // If invoice is provided, use matching logic
      if (invoice) {
        return this.matchPaymentLinksWithInvoice(invoice, []);
      }
      
      // If no invoice provided, return empty array
      return [];
    } catch (error) {
      console.error('Error fetching payment links:', error);
      throw error;
    }
  }

  /**
   * Get all payment links (if API supports it)
   * Tries multiple endpoint formats and date ranges
   */
  async getAllPaymentLinks(): Promise<ZohoPaymentLink[]> {
    try {
      if (!this.config.accountId) {
        throw new Error('Account ID is required for fetching payment links');
      }
      
      // Force use Payments auth for payment links
      const useBooksAuth = this.config.useBooksAuth;
      this.config.useBooksAuth = false;
      
      try {
        // Try different endpoint formats and date ranges
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
        const dateTo = today.toISOString().split('T')[0];
        
        // Try format 1: /paymentlinks with account_id and date range
        let url = `${this.paymentsBaseUrl}/paymentlinks?account_id=${this.config.accountId}&from=${dateFrom}&to=${dateTo}`;
        
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] Trying payment links endpoint:', url);
        }
        
        try {
          const response = await this.makeRequest(url);
          if (response.payment_links && response.payment_links.length > 0) {
            if (process.env.ZOHO_DEBUG === 'true') {
              console.log('[Zoho Debug] Successfully fetched payment links:', response.payment_links.length);
            }
            return response.payment_links;
          }
          // Try response.payment_link (singular) or response.data
          if (response.payment_link) {
            return Array.isArray(response.payment_link) ? response.payment_link : [response.payment_link];
          }
          if (response.data && Array.isArray(response.data)) {
            return response.data;
          }
        } catch (error1: any) {
          if (process.env.ZOHO_DEBUG === 'true') {
            console.log('[Zoho Debug] Endpoint format 1 failed:', error1.message);
          }
          
          // Try format 2: /paymentlinks without date range
          url = `${this.paymentsBaseUrl}/paymentlinks?account_id=${this.config.accountId}`;
          try {
            const response2 = await this.makeRequest(url);
            if (response2.payment_links && response2.payment_links.length > 0) {
              return response2.payment_links;
            }
            if (response2.payment_link) {
              return Array.isArray(response2.payment_link) ? response2.payment_link : [response2.payment_link];
            }
            if (response2.data && Array.isArray(response2.data)) {
              return response2.data;
            }
          } catch (error2: any) {
            if (process.env.ZOHO_DEBUG === 'true') {
              console.log('[Zoho Debug] Endpoint format 2 failed:', error2.message);
            }
            
            // Try format 3: /paymentlinks with per_page
            url = `${this.paymentsBaseUrl}/paymentlinks?account_id=${this.config.accountId}&per_page=200`;
            try {
              const response3 = await this.makeRequest(url);
              if (response3.payment_links && response3.payment_links.length > 0) {
                return response3.payment_links;
              }
              if (response3.payment_link) {
                return Array.isArray(response3.payment_link) ? response3.payment_link : [response3.payment_link];
              }
              if (response3.data && Array.isArray(response3.data)) {
                return response3.data;
              }
            } catch (error3: any) {
              if (process.env.ZOHO_DEBUG === 'true') {
                console.log('[Zoho Debug] All payment link endpoint formats failed. Last error:', error3.message);
                console.log('[Zoho Debug] Response structure:', JSON.stringify(response3, null, 2).substring(0, 500));
              }
            }
          }
        }
        
        // If all formats failed, return empty array
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] No payment links found. API may not support listing all payment links.');
        }
        return [];
      } finally {
        this.config.useBooksAuth = useBooksAuth;
      }
    } catch (error) {
      console.error('Error fetching all payment links:', error);
      if (process.env.ZOHO_DEBUG === 'true') {
        console.error('[Zoho Debug] Full error:', error);
      }
      return [];
    }
  }

  /**
   * Match payment links with invoice using order number and amount
   * Payment link description format: DDMMYYNNN
   * Invoice order number format: DDMMNNN (or from custom fields/description)
   * We extract NNN (unique number) from both and match, plus verify amount
   */
  static matchPaymentLinksWithInvoice(
    invoice: ZohoInvoice,
    paymentLinks: ZohoPaymentLink[]
  ): ZohoPaymentLink[] {
    const invoiceOrderNumber = this.extractOrderNumberFromInvoice(invoice);
    if (!invoiceOrderNumber) {
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Could not extract order number from invoice:', {
          invoice_number: invoice.invoice_number,
          description: invoice.description,
          custom_fields: invoice.custom_fields
        });
      }
      return [];
    }

    const matchedLinks: ZohoPaymentLink[] = [];

    for (const link of paymentLinks) {
      // Check if payment link has description
      if (!link.description) continue;

      // Extract order number from payment link description (DDMMYYNNN format)
      const linkOrderNumber = this.extractOrderNumberFromPaymentLink(link.description);
      
      if (!linkOrderNumber) {
        if (process.env.ZOHO_DEBUG === 'true') {
          console.log('[Zoho Debug] Could not extract order number from payment link description:', link.description);
        }
        continue;
      }

      // Match order numbers
      if (linkOrderNumber === invoiceOrderNumber) {
        // Additional validation: check amount match (with small tolerance for rounding)
        const amountDifference = Math.abs(link.amount - invoice.total);
        const tolerance = 0.01; // Allow 0.01 difference for rounding
        
        if (amountDifference <= tolerance) {
          matchedLinks.push(link);
          
          if (process.env.ZOHO_DEBUG === 'true') {
            console.log('[Zoho Debug] Matched payment link:', {
              invoiceNumber: invoice.invoice_number,
              invoiceOrderNumber,
              linkDescription: link.description,
              linkOrderNumber,
              invoiceAmount: invoice.total,
              linkAmount: link.amount,
              amountDifference
            });
          }
        } else {
          if (process.env.ZOHO_DEBUG === 'true') {
            console.log('[Zoho Debug] Order numbers match but amounts differ:', {
              invoiceNumber: invoice.invoice_number,
              invoiceAmount: invoice.total,
              linkAmount: link.amount,
              difference: amountDifference
            });
          }
        }
      }
    }

    return matchedLinks;
  }

  /**
   * Extract order number from invoice
   * Tries multiple sources: invoice_number, custom_fields, description
   * Formats supported:
   * - DDMMNNN (Day, Month, Order Number) - from invoice_number
   * - Custom fields or description containing order number
   */
  static extractOrderNumberFromInvoice(invoice: ZohoInvoice): string | null {
    // First, try to extract from invoice_number with DDMMNNN pattern
    const invoiceNumberMatch = invoice.invoice_number.match(/^(\d{2})(\d{2})(\d+)$/);
    if (invoiceNumberMatch) {
      return invoiceNumberMatch[3]; // Return NNN (order number)
    }

    // Try to extract from custom fields (look for fields that might contain order number)
    if (invoice.custom_fields && invoice.custom_fields.length > 0) {
      for (const field of invoice.custom_fields) {
        // Check if custom field value matches DDMMNNN pattern
        const customMatch = field.value?.match(/^(\d{2})(\d{2})(\d+)$/);
        if (customMatch) {
          return customMatch[3];
        }
        // Also check if it's just a number (might be order number)
        const numberMatch = field.value?.match(/^(\d+)$/);
        if (numberMatch && numberMatch[1].length >= 3) {
          // If it's a number with at least 3 digits, it might be the order number
          return numberMatch[1];
        }
      }
    }

    // Try to extract from description field
    if (invoice.description) {
      // Look for DDMMNNN pattern in description
      const descMatch = invoice.description.match(/(\d{2})(\d{2})(\d+)/);
      if (descMatch) {
        return descMatch[3];
      }
      // Look for standalone numbers that might be order numbers
      const numberMatch = invoice.description.match(/\b(\d{3,})\b/);
      if (numberMatch) {
        return numberMatch[1];
      }
    }

    // Try to extract from invoice_number if it has a different format (e.g., INV-004331)
    // Extract the numeric part after prefix
    const prefixMatch = invoice.invoice_number.match(/[-\s]?(\d+)$/);
    if (prefixMatch && prefixMatch[1].length >= 3) {
      return prefixMatch[1];
    }

    if (process.env.ZOHO_DEBUG === 'true') {
      console.log('[Zoho Debug] Could not extract order number from invoice:', {
        invoice_number: invoice.invoice_number,
        description: invoice.description,
        custom_fields: invoice.custom_fields
      });
    }

    return null;
  }

  /**
   * Extract order number from payment description
   * Format: DDMMYYNNN (Day, Month, Year, Order Number)
   */
  static extractOrderNumberFromPayment(description: string): string | null {
    // Match DDMMYYNNN pattern
    const match = description.match(/^(\d{2})(\d{2})(\d{2})(\d+)$/);
    if (match) {
      return match[4]; // Return NNN (order number)
    }
    return null;
  }

  /**
   * Extract order number from payment link description
   * Format: DDMMYYNNN (Day, Month, Year, Order Number)
   */
  static extractOrderNumberFromPaymentLink(description: string): string | null {
    // Match DDMMYYNNN pattern
    const match = description.match(/^(\d{2})(\d{2})(\d{2})(\d+)$/);
    if (match) {
      return match[4]; // Return NNN (order number)
    }
    return null;
  }

  /**
   * Match invoice with payment using order number
   */
  static matchInvoiceWithPayment(
    invoice: ZohoInvoice,
    payments: ZohoPayment[]
  ): ZohoPayment | null {
    const invoiceOrderNumber = this.extractOrderNumberFromInvoice(invoice);
    if (!invoiceOrderNumber) return null;

    for (const payment of payments) {
      if (payment.description) {
        const paymentOrderNumber = this.extractOrderNumberFromPayment(payment.description);
        if (paymentOrderNumber === invoiceOrderNumber) {
          return payment;
        }
      }
    }

    return null;
  }

  /**
   * Get customer phone number from invoice
   */
  static getCustomerPhone(invoice: ZohoInvoice): string | null {
    // Try contact persons first
    if (invoice.contact_persons && invoice.contact_persons.length > 0) {
      const primaryContact = invoice.contact_persons[0];
      return primaryContact.mobile || primaryContact.phone || null;
    }
    
    // Fallback to invoice phone field
    return invoice.phone || null;
  }
}

export default ZohoService;
export type { ZohoInvoice, ZohoPayment, ZohoPaymentLink, ZohoConfig };

