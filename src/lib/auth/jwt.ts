/**
 * JWT Authentication System
 * Handles user authentication and API secret verification
 */

import { createHmac, timingSafeEqual } from 'crypto';

function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

function createJWT(payload: any, secret: string, expiresIn: string): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  // ✅ FIX: Support longer expiration times for persistent login
  let exp: number;
  if (expiresIn === '24h') {
    exp = now + (24 * 60 * 60);
  } else if (expiresIn === '30d') {
    exp = now + (30 * 24 * 60 * 60); // 30 days
  } else if (expiresIn === '90d') {
    exp = now + (90 * 24 * 60 * 60); // 90 days
  } else {
    exp = now + 3600; // Default 1 hour
  }

  const fullPayload = {
    ...payload,
    iat: now,
    exp
  };

  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(fullPayload)));
  
  // Create HMAC-SHA256 signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(signatureInput)
    .digest();
  const encodedSignature = base64UrlEncode(signature);
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function verifyJWT(token: string, secret: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    
    // Verify signature using timing-safe comparison
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(signatureInput)
      .digest();
    const encodedExpectedSignature = base64UrlEncode(expectedSignature);
    
    if (signature.length !== encodedExpectedSignature.length) {
      return null;
    }
    
    // Use timing-safe comparison to prevent timing attacks
    const received = Buffer.from(signature);
    const expected = Buffer.from(encodedExpectedSignature);
    if (!timingSafeEqual(received, expected)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString());
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const API_SECRET = process.env.API_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface UserTokenPayload {
  id: string;
  butcherId: string;
  name: string;
  role?: 'butcher' | 'admin';
}

/**
 * Generate JWT token for user authentication
 * ✅ FIX: Use 30 days expiration for persistent login
 */
export function generateUserToken(user: UserTokenPayload): string {
  return createJWT(
    {
      id: user.id,
      butcherId: user.butcherId,
      name: user.name,
      role: user.role || 'butcher'
    },
    JWT_SECRET,
    '30d' // ✅ FIX: 30 days instead of 24h for persistent login
  );
}

/**
 * Verify and decode user JWT token
 * ✅ FIX: Returns token payload even if expired (for auto-refresh)
 */
export function verifyUserToken(token: string, allowExpired: boolean = false): UserTokenPayload | null {
  try {
    const decoded = verifyJWT(token, JWT_SECRET);
    if (decoded) {
      return decoded as UserTokenPayload;
    }
    
    // ✅ FIX: If expired but allowExpired is true, try to decode without expiration check
    if (allowExpired) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(base64UrlDecode(parts[1]).toString());
          // Verify signature even if expired
          const signatureInput = `${parts[0]}.${parts[1]}`;
          const expectedSignature = createHmac('sha256', JWT_SECRET)
            .update(signatureInput)
            .digest();
          const encodedExpectedSignature = base64UrlEncode(expectedSignature);
          
          // Use timing-safe comparison
          const received = Buffer.from(parts[2]);
          const expected = Buffer.from(encodedExpectedSignature);
          if (timingSafeEqual(received, expected)) {
            // Signature valid, return payload even if expired
            return payload as UserTokenPayload;
          }
        }
      } catch (e) {
        // Invalid token format or signature
      }
    }
    
    return null;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Verify API secret for Central API endpoint protection
 */
export function verifyAPISecret(secret: string): boolean {
  return secret === API_SECRET;
}

/**
 * Extract token from Authorization header
 * Format: "Bearer <token>" or just "<token>"
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }
  
  // Handle "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Handle just the token
  return authHeader;
}

