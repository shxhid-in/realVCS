import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts a value to a Date object
 * Handles Date objects, ISO strings, timestamps, and invalid values
 */
export function toDate(value: Date | string | number | undefined | null): Date | undefined {
  if (!value) return undefined;
  
  // Already a Date object
  if (value instanceof Date) {
    // Check if it's a valid date
    return isNaN(value.getTime()) ? undefined : value;
  }
  
  // String or number - try to parse
  try {
    const date = new Date(value as string | number);
    // Check if it's a valid date
    return isNaN(date.getTime()) ? undefined : date;
  } catch (error) {
    return undefined;
  }
}

/**
 * Safely gets the time value from a date
 * Returns 0 if date is invalid or undefined
 */
export function getTimeValue(date: Date | string | number | undefined | null): number {
  const dateObj = toDate(date);
  return dateObj ? dateObj.getTime() : 0;
}