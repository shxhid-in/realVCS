/**
 * Central API Client
 * Handles communication with Central API Middleware
 */

import axios, { AxiosInstance } from 'axios';

const CENTRAL_API_BASE_URL = process.env.CENTRAL_API_BASE_URL || 'http://localhost:3000';

interface TokenCache {
  token: string;
  expiry: number;
}

interface CentralAPIOrderItem {
  itemId: string;
  preparingWeight?: string; // Format: "1.5kg" or "500g"
  rejected?: string; // Rejection reason
  revenue?: number; // Revenue for accepted items in rupees
}

interface CentralAPIResponsePayload {
  butcher: string;
  items: CentralAPIOrderItem[];
  timestamp: string;
}

class CentralAPIClient {
  private baseUrl: string;
  private tokenCache: Map<string, TokenCache>;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.baseUrl = CENTRAL_API_BASE_URL;
    this.tokenCache = new Map();
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get Central API token for a specific butcher
   */
  async getToken(butcherName: string): Promise<string> {
    // Check cache first
    const cached = this.tokenCache.get(butcherName);
    if (cached && Date.now() < cached.expiry - 3600000) { // 1 hour buffer
      return cached.token;
    }

    try {
      console.log(`[CentralAPI] Requesting token for butcher: ${butcherName}`);
      
      const response = await this.axiosInstance.post('/api/auth/token', {
        role: 'vcs',
        systemId: butcherName // Must match exactly: "Usaj Meat Hub", "PKD Stall", etc.
      });

      const token = response.data.token;
      
      if (!token) {
        throw new Error('Token not received from Central API');
      }

      // Cache the token (assuming 24h expiry)
      this.tokenCache.set(butcherName, {
        token,
        expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      });

      console.log(`[CentralAPI] Token cached for butcher: ${butcherName}`);
      return token;
    } catch (error: any) {
      console.error(`[CentralAPI] Error getting token for ${butcherName}:`, error.message);
      
      // Fallback: Return a dummy token or throw error
      // In production, you might want to queue the request instead
      throw new Error(`Failed to get Central API token: ${error.message}`);
    }
  }

  /**
   * Send order response to Central API
   */
  async sendOrderResponse(
    orderNo: number,
    butcher: string,
    items: CentralAPIOrderItem[]
  ): Promise<void> {
    try {
      // Get token for this butcher
      const token = await this.getToken(butcher);
      
      const payload: CentralAPIResponsePayload = {
        butcher,
        items,
        timestamp: new Date().toISOString()
      };

      console.log(`[CentralAPI] Sending response for order ${orderNo} from ${butcher}`);
      console.log(`[CentralAPI] Payload:`, JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post(
        `/api/orders/${orderNo}/response`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log(`[CentralAPI] Response sent successfully for order ${orderNo}`);
      return response.data;
    } catch (error: any) {
      console.error(`[CentralAPI] Error sending response for order ${orderNo}:`, error.message);
      
      if (error.response) {
        console.error(`[CentralAPI] Response status: ${error.response.status}`);
        console.error(`[CentralAPI] Response data:`, error.response.data);
      }
      
      throw new Error(`Failed to send order response: ${error.message}`);
    }
  }

  /**
   * Clear token cache for a specific butcher
   */
  clearTokenCache(butcherName: string): void {
    this.tokenCache.delete(butcherName);
  }

  /**
   * Clear all token caches
   */
  clearAllTokenCaches(): void {
    this.tokenCache.clear();
  }

  /**
   * Notify Central API that menu has been updated
   */
  async notifyMenuUpdate(
    butcherId: string,
    butcherName: string
  ): Promise<void> {
    try {
      const token = await this.getToken(butcherName);
      
      const payload = {
        butcher: butcherName,
        butcherId: butcherId,
        timestamp: new Date().toISOString(),
        source: 'vcs'
      };

      console.log(`[CentralAPI] Notifying menu update for ${butcherName} (${butcherId})`);
      console.log(`[CentralAPI] Payload:`, JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post(
        '/api/menu/update',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      console.log(`[CentralAPI] Menu update notification sent successfully for ${butcherName}`);
      return response.data;
    } catch (error: any) {
      console.error(`[CentralAPI] Error notifying menu update for ${butcherName}:`, error.message);
      
      if (error.response) {
        console.error(`[CentralAPI] Response status: ${error.response.status}`);
        console.error(`[CentralAPI] Response data:`, error.response.data);
      }
      
      // Re-throw to allow caller to handle (e.g., queue for retry)
      throw new Error(`Failed to notify menu update: ${error.message}`);
    }
  }
}

// Export singleton instance
export const centralAPIClient = new CentralAPIClient();

// Export types
export type { CentralAPIOrderItem, CentralAPIResponsePayload };

