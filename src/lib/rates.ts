import type { CommissionRate, MarkupRate, ButcherRates } from './types';

// Default commission rates by butcher and category
export const DEFAULT_COMMISSION_RATES: CommissionRate[] = [
  // KA Sons - 7% for all items
  { butcherId: 'ka_sons', category: 'seawater fish', rate: 0.07 },
  { butcherId: 'ka_sons', category: 'freshwater fish', rate: 0.07 },
  { butcherId: 'ka_sons', category: 'meat item', rate: 0.07 },
  
  // KAK - 7% for all items
  { butcherId: 'kak', category: 'seawater fish', rate: 0.07 },
  { butcherId: 'kak', category: 'freshwater fish', rate: 0.07 },
  { butcherId: 'kak', category: 'meat item', rate: 0.07 },
  
  // Usaj - 10% for all items
  { butcherId: 'usaj', category: 'chicken', rate: 0.10 },
  { butcherId: 'usaj', category: 'beef', rate: 0.10 },
  
  // Usaj Mutton - 8% for all items
  { butcherId: 'usaj_mutton', category: 'mutton', rate: 0.08 },
  
  // PKD - 12% for all items
  { butcherId: 'pkd', category: 'chicken', rate: 0.12 },
  { butcherId: 'pkd', category: 'mutton', rate: 0.12 },
  
  // Alif - 10% for all items
  { butcherId: 'alif', category: 'seawater fish', rate: 0.10 },
  { butcherId: 'alif', category: 'freshwater fish', rate: 0.10 },
  { butcherId: 'alif', category: 'meat item', rate: 0.10 },
  
  // Test Meat Butcher - 10% for chicken (same as usaj)
  { butcherId: 'test_meat', category: 'chicken', rate: 0.10 },
  { butcherId: 'test_meat', category: 'beef', rate: 0.10 },
  { butcherId: 'test_meat', category: 'mutton', rate: 0.10 },
  
  // Test Fish Butcher - 7% for all items (same as kak/ka_sons)
  { butcherId: 'test_fish', category: 'seawater fish', rate: 0.07 },
  { butcherId: 'test_fish', category: 'freshwater fish', rate: 0.07 },
  { butcherId: 'test_fish', category: 'meat item', rate: 0.07 },
];

// Default markup rates by butcher and category
export const DEFAULT_MARKUP_RATES: MarkupRate[] = [
  // All butchers - 5% for all items except mutton and beef (which have 0% markup)
  // Note: Category names are case-insensitive, but stored in lowercase for consistency
  { butcherId: 'ka_sons', category: 'seawater fish', rate: 0.05 },
  { butcherId: 'ka_sons', category: 'freshwater fish', rate: 0.05 },
  { butcherId: 'ka_sons', category: 'meat item', rate: 0.05 },
  
  { butcherId: 'kak', category: 'seawater fish', rate: 0.05 },
  { butcherId: 'kak', category: 'freshwater fish', rate: 0.05 },
  { butcherId: 'kak', category: 'meat item', rate: 0.05 },
  
  { butcherId: 'usaj', category: 'chicken', rate: 0.05 },
  { butcherId: 'usaj', category: 'beef', rate: 0.00 }, // 0% markup for beef
  
  { butcherId: 'usaj_mutton', category: 'mutton', rate: 0.00 }, // 0% markup for mutton
  
  { butcherId: 'pkd', category: 'chicken', rate: 0.05 },
  { butcherId: 'pkd', category: 'mutton', rate: 0.00 }, // 0% markup for mutton
  
  { butcherId: 'alif', category: 'seawater fish', rate: 0.05 },
  { butcherId: 'alif', category: 'freshwater fish', rate: 0.05 },
  { butcherId: 'alif', category: 'meat item', rate: 0.05 },
  
  { butcherId: 'test_meat', category: 'chicken', rate: 0.05 },
  { butcherId: 'test_meat', category: 'beef', rate: 0.00 },
  { butcherId: 'test_meat', category: 'mutton', rate: 0.00 }, // 0% markup for mutton

  { butcherId: 'test_fish', category: 'seawater fish', rate: 0.05 },
  { butcherId: 'test_fish', category: 'freshwater fish', rate: 0.05 },
  { butcherId: 'test_fish', category: 'meat item', rate: 0.05 },
];

// Get all butcher rates with default values
export const getDefaultButcherRates = (): ButcherRates[] => {
  // Hardcode butcher IDs to avoid dependency issues
  const butcherIds = ['usaj', 'usaj_mutton', 'pkd', 'kak', 'ka_sons', 'alif'];
  
  return butcherIds.map(butcherId => {
    const commissionRates = DEFAULT_COMMISSION_RATES.filter(rate => rate.butcherId === butcherId);
    const markupRates = DEFAULT_MARKUP_RATES.filter(rate => rate.butcherId === butcherId);
    
    return {
      butcherId,
      butcherName: butcherId, // Use ID as name for now
      commissionRates,
      markupRates
    };
  });
};

// Get commission rate for a specific butcher and category
export const getCommissionRate = (butcherId: string, category: string, customRates?: CommissionRate[]): number => {
  const rates = DEFAULT_COMMISSION_RATES;
  const categoryLower = category.toLowerCase();
  
  // Try exact match first (case-insensitive)
  let rate = rates.find(r => r.butcherId === butcherId && r.category.toLowerCase() === categoryLower);
  
  // If no exact match, try partial matching for common variations (case-insensitive)
  if (!rate) {
    rate = rates.find(r => r.butcherId === butcherId && (
      r.category.toLowerCase() === categoryLower ||
      categoryLower.includes(r.category.toLowerCase()) ||
      r.category.toLowerCase().includes(categoryLower)
    ));
  }
  
  return rate ? rate.rate : 0.07; // Default to 7% if not found
};

// Get markup rate for a specific butcher and category
export const getMarkupRate = (butcherId: string, category: string, customRates?: MarkupRate[]): number => {
  const rates = customRates || DEFAULT_MARKUP_RATES;
  const categoryLower = category.toLowerCase();
  
  // Try exact match first (case-insensitive)
  let rate = rates.find(r => r.butcherId === butcherId && r.category.toLowerCase() === categoryLower);
  
  // If no exact match, try partial matching for common variations (case-insensitive)
  if (!rate) {
    rate = rates.find(r => r.butcherId === butcherId && (
      r.category.toLowerCase() === categoryLower ||
      categoryLower.includes(r.category.toLowerCase()) ||
      r.category.toLowerCase().includes(categoryLower)
    ));
  }
  
  
  // If rate not found, use appropriate default based on category
  if (!rate) {
    // Beef and mutton items have 0% markup by default
    if (categoryLower === 'beef' || categoryLower === 'mutton' || 
        categoryLower.includes('beef') || categoryLower.includes('mutton')) {
      return 0.00;
    }
    // All other items have 5% markup by default
    return 0.05;
  }
  
  return rate.rate;
};

// Get categories for a specific butcher
export const getButcherCategories = (butcherId: string): string[] => {
  switch (butcherId) {
    case 'usaj':
      return ['chicken', 'beef'];
    case 'usaj_mutton':
      return ['mutton'];
    case 'pkd':
      return ['chicken', 'mutton'];
    case 'kak':
    case 'ka_sons':
    case 'alif':
      return ['seawater fish', 'freshwater fish', 'meat item'];
    default:
      return [];
  }
};

// Validate rate values
export const validateRate = (rate: number): boolean => {
  return rate >= 0 && rate <= 1; // Between 0% and 100%
};

// Format rate for display
export const formatRate = (rate: number): string => {
  return `${(rate * 100).toFixed(1)}%`;
};

// Parse rate from input
export const parseRate = (input: string): number => {
  const value = parseFloat(input);
  if (isNaN(value)) return 0;
  return value / 100; // Convert percentage to decimal
};
