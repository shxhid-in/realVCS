/**
 * Item name normalization for consistent matching
 */

export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,/g, '') // Remove commas
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}
