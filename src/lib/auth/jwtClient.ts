/**
 * Client-Side JWT Utilities
 * For browser use - only decodes payload, doesn't verify signature
 * Signature verification happens server-side
 */

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return atob(base64);
  } catch (e) {
    return '';
  }
}

export interface UserTokenPayload {
  id: string;
  butcherId: string;
  name: string;
  role?: 'butcher' | 'admin';
  exp?: number;
  iat?: number;
}

/**
 * Decode JWT token payload (client-side only - no signature verification)
 * Signature verification happens server-side
 */
export function decodeUserToken(token: string): UserTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload as UserTokenPayload;
  } catch (error) {
    console.error('JWT decode failed:', error);
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeUserToken(token);
  if (!payload || !payload.exp) {
    return true; // Consider expired if no expiration
  }
  return payload.exp < Math.floor(Date.now() / 1000);
}

