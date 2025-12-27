/**
 * Zoho OAuth2 Token Management
 * Handles token refresh for both Zoho Books/Invoice and Zoho Payments
 */

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface ZohoAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  dataCenter?: string;
}

class ZohoAuth {
  private booksCache: TokenCache | null = null;
  private paymentsCache: TokenCache | null = null;
  private booksConfig: ZohoAuthConfig;
  private paymentsConfig: ZohoAuthConfig;

  constructor() {
    // Zoho Books/Invoice Configuration
    this.booksConfig = {
      clientId: process.env.ZOHO_CLIENT_ID || '',
      clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
      refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
      dataCenter: process.env.ZOHO_DATA_CENTER || 'com',
    };

    // Zoho Payments Configuration
    this.paymentsConfig = {
      clientId: process.env.ZOHO_PAYMENTS_CLIENT_ID || '',
      clientSecret: process.env.ZOHO_PAYMENTS_CLIENT_SECRET || '',
      refreshToken: process.env.ZOHO_PAYMENTS_REFRESH_TOKEN || '',
      dataCenter: process.env.ZOHO_DATA_CENTER || 'com',
    };

    // Validate credentials on initialization (only log in debug mode)
    if (process.env.ZOHO_DEBUG === 'true') {
      const booksMissing = [];
      const paymentsMissing = [];
      
      if (!this.booksConfig.clientId) booksMissing.push('ZOHO_CLIENT_ID');
      if (!this.booksConfig.clientSecret) booksMissing.push('ZOHO_CLIENT_SECRET');
      if (!this.booksConfig.refreshToken) booksMissing.push('ZOHO_REFRESH_TOKEN');
      
      if (!this.paymentsConfig.clientId) paymentsMissing.push('ZOHO_PAYMENTS_CLIENT_ID');
      if (!this.paymentsConfig.clientSecret) paymentsMissing.push('ZOHO_PAYMENTS_CLIENT_SECRET');
      if (!this.paymentsConfig.refreshToken) paymentsMissing.push('ZOHO_PAYMENTS_REFRESH_TOKEN');
      
      if (booksMissing.length > 0) {
        console.warn('[Zoho Debug] Missing Books credentials:', booksMissing);
      }
      if (paymentsMissing.length > 0) {
        console.warn('[Zoho Debug] Missing Payments credentials:', paymentsMissing);
      }
    }
  }

  /**
   * Get domain for data center
   */
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

  /**
   * Refresh access token using refresh token
   */
  private async refreshToken(config: ZohoAuthConfig): Promise<string> {
    const domain = this.getDomain(config.dataCenter || 'com');
    const tokenUrl = `https://accounts.zoho.${domain}/oauth/v2/token`;

    // Validate credentials
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      const missing = [];
      if (!config.clientId) missing.push('clientId');
      if (!config.clientSecret) missing.push('clientSecret');
      if (!config.refreshToken) missing.push('refreshToken');
      throw new Error(`Missing Zoho credentials: ${missing.join(', ')}`);
    }

    // Sanitize credentials (remove quotes, trim whitespace)
    const sanitizedConfig = {
      clientId: config.clientId.replace(/^["']|["']$/g, '').trim(),
      clientSecret: config.clientSecret.replace(/^["']|["']$/g, '').trim(),
      refreshToken: config.refreshToken.replace(/^["']|["']$/g, '').trim(),
    };

    const params = new URLSearchParams({
      refresh_token: sanitizedConfig.refreshToken,
      client_id: sanitizedConfig.clientId,
      client_secret: sanitizedConfig.clientSecret,
      grant_type: 'refresh_token',
    });

    try {
      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Refreshing token:', {
          tokenUrl,
          dataCenter: domain,
          hasClientId: !!sanitizedConfig.clientId,
          hasClientSecret: !!sanitizedConfig.clientSecret,
          hasRefreshToken: !!sanitizedConfig.refreshToken,
        });
      }

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: 'unknown', error_description: errorText };
        }

        if (process.env.ZOHO_DEBUG === 'true') {
          console.error('[Zoho Debug] Token refresh failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData.error,
            error_description: errorData.error_description,
            tokenUrl,
          });
        }

        throw new Error(`Token refresh failed: ${response.status} - ${errorData.error || 'unknown error'} - ${errorData.error_description || errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        if (process.env.ZOHO_DEBUG === 'true') {
          console.error('[Zoho Debug] Token refresh error:', {
            error: data.error,
            error_description: data.error_description,
            tokenUrl,
          });
        }
        throw new Error(`Token refresh error: ${data.error} - ${data.error_description || ''}`);
      }

      // Access token expires in 1 hour (3600 seconds)
      // Refresh 5 minutes before expiration for safety
      const expiresIn = (data.expires_in || 3600) * 1000; // Convert to milliseconds
      const expiresAt = Date.now() + expiresIn - (5 * 60 * 1000); // 5 minutes buffer

      if (process.env.ZOHO_DEBUG === 'true') {
        console.log('[Zoho Debug] Token refreshed successfully:', {
          expiresIn: data.expires_in,
          hasAccessToken: !!data.access_token,
        });
      }

      return data.access_token;
    } catch (error) {
      if (process.env.ZOHO_DEBUG === 'true') {
        console.error('[Zoho Debug] Error refreshing Zoho token:', error);
      }
      throw error;
    }
  }

  /**
   * Get valid access token for Zoho Books/Invoice
   * Automatically refreshes if expired or about to expire
   */
  async getBooksAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (
      this.booksCache &&
      this.booksCache.expiresAt > Date.now() &&
      this.booksCache.accessToken
    ) {
      return this.booksCache.accessToken;
    }

    // Refresh token
    const accessToken = await this.refreshToken(this.booksConfig);
    
    // Cache the new token
    const expiresIn = 3600 * 1000; // 1 hour in milliseconds
    this.booksCache = {
      accessToken,
      expiresAt: Date.now() + expiresIn - (5 * 60 * 1000), // 5 minutes buffer
    };

    return accessToken;
  }

  /**
   * Get valid access token for Zoho Payments
   * Automatically refreshes if expired or about to expire
   */
  async getPaymentsAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (
      this.paymentsCache &&
      this.paymentsCache.expiresAt > Date.now() &&
      this.paymentsCache.accessToken
    ) {
      return this.paymentsCache.accessToken;
    }

    // Refresh token
    const accessToken = await this.refreshToken(this.paymentsConfig);
    
    // Cache the new token
    const expiresIn = 3600 * 1000; // 1 hour in milliseconds
    this.paymentsCache = {
      accessToken,
      expiresAt: Date.now() + expiresIn - (5 * 60 * 1000), // 5 minutes buffer
    };

    return accessToken;
  }

  /**
   * Clear token cache (useful for testing or forced refresh)
   */
  clearCache() {
    this.booksCache = null;
    this.paymentsCache = null;
  }
}

// Singleton instance
let zohoAuthInstance: ZohoAuth | null = null;

export function getZohoAuth(): ZohoAuth {
  if (!zohoAuthInstance) {
    zohoAuthInstance = new ZohoAuth();
  }
  return zohoAuthInstance;
}

export type { ZohoAuthConfig };

