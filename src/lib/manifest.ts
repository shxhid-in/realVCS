/**
 * Utility functions for manifest.json handling
 * Simplified to use a single manifest file for all purposes
 */

export interface ManifestConfig {
  slug?: string;
  baseUrl?: string;
  isTWA?: boolean;
}

/**
 * Generate manifest URL based on configuration
 * @param config - Configuration object
 * @returns The manifest URL
 */
export function getManifestUrl(config: ManifestConfig = {}): string {
  const { baseUrl = '' } = config;
  
  // Generate cache-busting version
  // Use a combination of build time and current time for better cache busting
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || '20250929051226';
  const currentTime = Date.now();
  const version = `v=${buildTime}-${currentTime}`;
  
  // Always use manifest-v2.json as the single manifest file
  return `${baseUrl}/manifest-v2.json?${version}`;
}

/**
 * Get the default manifest URL (for backward compatibility)
 * @param baseUrl - Base URL of the application
 * @returns The default manifest URL
 */
export function getDefaultManifestUrl(baseUrl: string = ''): string {
  return `${baseUrl}/manifest-v2.json`;
}

/**
 * Get manifest URL for TWA (Trusted Web Activity)
 * @param baseUrl - Base URL of the application
 * @returns The manifest URL for TWA
 */
export function getTWAManifestUrl(baseUrl: string = ''): string {
  return `${baseUrl}/manifest-v2.json`;
}

/**
 * Validate manifest slug format (kept for backward compatibility)
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidManifestSlug(slug: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

/**
 * Common manifest slugs for different use cases (simplified)
 */
export const MANIFEST_SLUGS = {
  DEFAULT: 'default',
  TWA: 'twa',
  PWA: 'pwa',
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
} as const;

export type ManifestSlug = typeof MANIFEST_SLUGS[keyof typeof MANIFEST_SLUGS];
