/**
 * Butcher Configuration
 * Centralized configuration for all butchers including categories, commission rates, and sheet tabs
 */

import type { MenuCategory, MenuItem, Butcher } from './types';

// Helper to create a default size for items
const defaultSize = (price: number = 0) => [{ id: `s-${Math.random()}`, size: 'default' as const, price }];

// Helper to create all three sizes for fish items (Small, Medium, Large)
const fishSizes = (smallPrice: number = 0, mediumPrice: number = 0, largePrice: number = 0) => [
  { id: `s-${Math.random()}`, size: 'small' as const, price: smallPrice },
  { id: `s-${Math.random()}`, size: 'medium' as const, price: mediumPrice },
  { id: `s-${Math.random()}`, size: 'big' as const, price: largePrice }
];

// Helper to create menu items with unavailable status by default
const createUnavailableItem = (id: string, name: string, unit: 'kg' | 'nos', sizes: any[]): MenuItem => ({
  id,
  name,
  unit,
  available: false,
  sizes
});

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

export const CATEGORIES = {
  // Meat Categories
  chicken: {
    id: 'chicken',
    name: 'Chicken',
    items: [
      createUnavailableItem('c1i1', 'chicken meat', 'kg', defaultSize()),
      createUnavailableItem('c1i3', 'chicken leg', 'kg', defaultSize()),
      createUnavailableItem('c1i4', 'chicken breast bone', 'kg', defaultSize()),
      createUnavailableItem('c1i5', 'chicken breast boneless', 'kg', defaultSize()),
      createUnavailableItem('c1i6', 'chicken lollipop', 'kg', defaultSize()),
      createUnavailableItem('c1i7', 'chicken parts', 'kg', defaultSize()),
      createUnavailableItem('c1i8', 'chicken nadan', 'kg', defaultSize()),
      createUnavailableItem('c1i9', 'chicken thigh', 'kg', defaultSize()),
    ]
  },
  
  mutton: {
    id: 'mutton',
    name: 'Mutton',
    items: [
      createUnavailableItem('m1i1', 'mutton meat', 'kg', defaultSize()),
      createUnavailableItem('m1i2', 'mutton rib', 'kg', defaultSize()),
      createUnavailableItem('m1i3', 'mutton boneless', 'kg', defaultSize()),
      createUnavailableItem('m1i4', 'mutton liver', 'kg', defaultSize()),
      createUnavailableItem('m1i5', 'mutton brain', 'nos', defaultSize()),
      createUnavailableItem('m1i6', 'mutton head', 'kg', defaultSize()),
      createUnavailableItem('m1i7', 'mutton botty', 'kg', defaultSize()),
      createUnavailableItem('m1i8', 'mutton paaya', 'kg', defaultSize()),
    ]
  },
  
  beef: {
    id: 'beef',
    name: 'Beef',
    items: [
      createUnavailableItem('b1i1', 'beef meat', 'kg', defaultSize()),
      createUnavailableItem('b1i2', 'beef liver', 'kg', defaultSize()),
    ]
  },
  
  // Fish Categories
  seaWaterFish: {
    id: 'sea-water-fish',
    name: 'Sea Water Fish',
    items: [
      createUnavailableItem('i-ayala', 'Ayala - Mackerel - അയല', 'kg', fishSizes()),
      createUnavailableItem('i-mathi', 'Mathi - Sardine - മത്തി', 'kg', fishSizes()),
      createUnavailableItem('i-chemmeen', 'Chemmeen - Prawns - ചെമ്മീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-tigerchemmeen', 'Tiger Chemmeen - Tiger Prawns - ടൈഗർ ചെമ്മീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-naranchemmeen', 'Naran Chemmeen - Naran Prawns - നരൻ ചെമ്മീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-nethal', 'Nethal - Anchovy - നെത്തൾ', 'kg', fishSizes()),
      createUnavailableItem('i-chemballi', 'Chemballi - Bullseye - ചെമ്പല്ലി', 'kg', fishSizes()),
      createUnavailableItem('i-kilimeen', 'Kilimeen - Pink Perch - കിളിമീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-mullan', 'Mullan - Pony Fish - മുള്ളൻ', 'kg', fishSizes()),
      createUnavailableItem('i-cdmullan', 'CD Mullan - CD Pony Fish - CD മുള്ളൻ', 'kg', fishSizes()),
      createUnavailableItem('i-manthal', 'Manthal - Sole Fish - മാന്തൾ', 'kg', fishSizes()),
      createUnavailableItem('i-velameen', 'Velameen - Emperor - വെളമീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-blackaavoli', 'Black Aavoli - Black Pomfret - ആവോലി', 'kg', fishSizes()),
      createUnavailableItem('i-vellaaavoli', 'Vella Aavoli - White Pomfret - വെള്ള ആവോലി', 'kg', fishSizes()),
      createUnavailableItem('i-silveraavoli', 'Silver Aavoli - Silver Pomfret - സിൽവർ ആവോലി', 'kg', fishSizes()),
      createUnavailableItem('i-kera', 'Kera - Kera - കേര', 'kg', fishSizes()),
      createUnavailableItem('i-sravu-sea', 'Sravu - Shark - സ്രാവ്', 'kg', fishSizes()),
      createUnavailableItem('i-vatta-sea', 'Vatta - Trevally - വറ്റ', 'kg', fishSizes()),
      createUnavailableItem('i-hamour', 'Hamour - Hamour - ഹമൂർ', 'kg', fishSizes()),
      createUnavailableItem('i-redsnapper', 'Red Snapper - Red Snapper - റെഡ് സ്‌നാപ്പർ', 'kg', fishSizes()),
      createUnavailableItem('i-whitesnapper', 'White Snapper - White Snapper - വൈറ്റ് സ്നാപ്പർ', 'kg', fishSizes()),
      createUnavailableItem('i-yellowsnapper', 'Yellow Snapper - Yellow Snapper - യെല്ലോ സ്‌നാപ്പർ', 'kg', fishSizes()),
      createUnavailableItem('i-koonthal', 'Koonthal - Squid - കൂന്തൾ', 'kg', fishSizes()),
      createUnavailableItem('i-choora', 'Choora - Tuna - ചൂര', 'kg', fishSizes()),
      createUnavailableItem('i-vellachoora', 'Vella Choora - White Tuna - വെള്ള ചൂര', 'kg', fishSizes()),
      createUnavailableItem('i-kazhanthanchemmeen', 'Kazhanthan Chemmeen - Kazhanthan Prawns - കഴന്തൻ ചെമ്മീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-nandu', 'Nandu - Crab - നണ്ട്', 'kg', fishSizes()),
      createUnavailableItem('i-eari', 'Eari - Emperor - ഏരി', 'kg', fishSizes()),
      createUnavailableItem('i-kakka', 'Kakka - Clam - കക്ക', 'kg', fishSizes()),
      createUnavailableItem('i-kalanji', 'Kalanji - Sea Bass - കാളാഞ്ചി', 'kg', fishSizes()),
      createUnavailableItem('i-poomeen-sea', 'Poomeen - Milk Fish - പൂമീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-aykora-sea', 'Aykora - King Fish - അയ്‌കോറ', 'kg', fishSizes()),
      createUnavailableItem('i-ayalakanni', 'Ayalakanni - Indian Mackerel - അയലകണ്ണി', 'kg', fishSizes()),
      createUnavailableItem('i-kanambu', 'Kanambu - Silver Mullet - കണമ്പ്', 'kg', fishSizes()),
      createUnavailableItem('i-etta-sea', 'Etta - Cat Fish - ഏട്ട', 'kg', fishSizes()),
      createUnavailableItem('i-veloori', 'Veloori - White Sardine - വേളൂരി', 'kg', fishSizes()),
      createUnavailableItem('i-velladavu', 'Velladavu - Silver Belly - വെള്ളടവ്', 'kg', fishSizes()),
      createUnavailableItem('i-sheelavu-sea', 'Sheelavu - Baraccuda - ഷീലാവ്', 'kg', fishSizes()),
      createUnavailableItem('i-kolaan', 'Kolaan - Gar Fish - കോലാൻ', 'kg', fishSizes()),
      createUnavailableItem('i-kozhuva', 'Kozhuva - Anchovy - കൊഴുവ', 'kg', fishSizes()),
      createUnavailableItem('i-chalamathi', 'Chala Mathi - Sardine - ചാളമത്തി', 'kg', fishSizes()),
      createUnavailableItem('i-aayirampalli', 'Aayiram Palli - Halibut - ആയിരംപല്ലി', 'kg', fishSizes()),
      createUnavailableItem('i-thalayan', 'Thalayan - Ruben Fish - തളയൻ', 'kg', fishSizes()),
      createUnavailableItem('i-ayalachembaan', 'Ayalachembaan - Chemban Mackerel - അയല ചെമ്പാൻ', 'kg', fishSizes()),
      createUnavailableItem('i-vellavatta', 'Vella Vatta - White Trevally - വെള്ള വറ്റ', 'kg', fishSizes())
    ]
  },
  
  freshWaterFish: {
    id: 'fresh-water-fish',
    name: 'Fresh Water Fish',
    items: [
      createUnavailableItem('i-vellachemmeen', 'Vella Chemmeen - White Prawns  - വെള്ള ചെമ്മീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-damvaala', 'Dam Vaala - Basa Fish - ഡാം വാള', 'kg', fishSizes()),
      createUnavailableItem('i-karimeen', 'Karimeen - Pearl Spot -  കരിമീൻ', 'kg', fishSizes()),
      createUnavailableItem('i-silopia', 'Silopia - Tilapia - സിലോപ്യ', 'kg', fishSizes()),
      createUnavailableItem('i-damkatla', 'Dam Katla - Dam Carp - ഡാം കട്ടള', 'kg', fishSizes()),
      createUnavailableItem('i-damroohu', 'Dam Roohu - Dam Labeo - ഡാം റൂഹ്', 'kg', fishSizes()),
      createUnavailableItem('i-damaavoli', 'Dam Aavoli - Dam Pomfret - ഡാം ആവോലി', 'kg', fishSizes()),
      createUnavailableItem('i-kadalkannan', 'Murrel - Kadal Kannan - കടൽ കണ്ണൻ', 'kg', fishSizes()),
      createUnavailableItem('i-varal', 'Varal - Snake Head - വരാൽ', 'kg', fishSizes()),
      createUnavailableItem('i-attuvaala', 'Aattu Vaala - Boal - ആറ്റു വാള', 'kg', fishSizes()),
    ]
  },
  
  steakFish: {
    id: 'steak-fish',
    name: 'Steak Fish',
    items: [
      createUnavailableItem('i-olaneymeen', 'Ola Neymeen Meat - Sail Fish Meat - ഓല നെയ്മീൻ', 'kg', defaultSize()),
      createUnavailableItem('i-sravu-meat', 'Sravu Meat - Shark Meat - സ്രാവ്', 'kg', defaultSize()),
      createUnavailableItem('i-modha-meat', 'Modha Meat - Butter Fish Meat - മോദ', 'kg', defaultSize()),
      createUnavailableItem('i-ottimodha-meat', 'Otti Modha Meat - Otti Butter Fish Meat - ഓട്ടി മോദ', 'kg', defaultSize()),
      createUnavailableItem('i-vatta-meat', 'Vatta Meat - Trevally Meat - വറ്റ', 'kg', defaultSize()),
      createUnavailableItem('i-poomeen-meat', 'Poomeen Meat - Milk Fish Meat - പൂമീൻ', 'kg', defaultSize()),
      createUnavailableItem('i-etta-meat', 'Etta Meat - Cat Fish Meat - ഏട്ട', 'kg', defaultSize()),
      createUnavailableItem('i-therandi', 'Therandi Meat - String Ray Meat - തെരണ്ടി', 'kg', defaultSize()),
      createUnavailableItem('i-kera-meat', 'Kera Meat - Kera Meat - കേര', 'kg', defaultSize()),
      createUnavailableItem('i-aykora-meat', 'Aykora Meat - King Fish Meat - അയ്‌കോറ', 'kg', defaultSize()),
    ]
  }
} as const;

// ============================================================================
// BUTCHER PASSWORDS (stored separately for security)
// ============================================================================

export const BUTCHER_PASSWORDS: Record<string, string> = {
  'usaj': 'password',
  'usaj_mutton': 'password',
  'pkd': 'password',
  'kak': 'password',
  'ka_sons': 'password',
  'alif': 'password',
  'test_meat': 'test',
  'test_fish': 'test',
  'tendor_chops': 'password',
  // Add mixed butcher passwords here when created
};

// ============================================================================
// BUTCHER CONFIGURATIONS
// ============================================================================

export interface ButcherConfig {
  id: string;
  name: string;
  type: 'meat' | 'fish' | 'mixed';
  categories: string[]; // Category IDs from CATEGORIES object
  commissionRates: Record<string, number>; // Category name -> commission rate (decimal)
  markupRates?: Record<string, number>; // Category name -> markup rate (decimal)
  orderSheetTab: string; // Tab name in ButcherPOS sheet
  meatSheetTab?: string; // Tab name in Menu sheet for meat products (for mixed butchers)
  fishSheetTab?: string; // Tab name in Menu sheet for fish items (for mixed butchers)
}

export const BUTCHER_CONFIGS: Record<string, ButcherConfig> = {
  // Meat Butchers
  usaj: {
    id: 'usaj',
    name: 'Usaj Meat Hub',
    type: 'meat',
    categories: ['chicken', 'beef'],
    commissionRates: {
      'Chicken': 0.10,
      'Beef': 0.10
    },
    markupRates: {
      'Chicken': 0.05,
      'Beef': 0.00
    },
    orderSheetTab: 'Usaj_Meat_Hub',
    meatSheetTab: 'Usaj_Meat_Hub'
  },
  
  usaj_mutton: {
    id: 'usaj_mutton',
    name: 'Usaj Mutton Shop',
    type: 'meat',
    categories: ['mutton'],
    commissionRates: {
      'Mutton': 0.08
    },
    markupRates: {
      'Mutton': 0.00
    },
    orderSheetTab: 'Usaj_Mutton_Shop',
    meatSheetTab: 'Usaj_Mutton_Shop'
  },
  
  pkd: {
    id: 'pkd',
    name: 'PKD Stall',
    type: 'meat',
    categories: ['chicken', 'mutton'],
    commissionRates: {
      'Chicken': 0.12,
      'Mutton': 0.12
    },
    markupRates: {
      'Chicken': 0.05,
      'Mutton': 0.00
    },
    orderSheetTab: 'PKD_Stall',
    meatSheetTab: 'PKD_Stall'
  },
  
  // Fish Butchers
  kak: {
    id: 'kak',
    name: 'KAK',
    type: 'fish',
    categories: ['sea-water-fish', 'fresh-water-fish', 'steak-fish'],
    commissionRates: {
      'Sea Water Fish': 0.07,
      'Fresh Water Fish': 0.07,
      'Steak Fish': 0.07
    },
    markupRates: {
      'Sea Water Fish': 0.05,
      'Fresh Water Fish': 0.05,
      'Steak Fish': 0.05
    },
    orderSheetTab: 'KAK',
    fishSheetTab: 'KAK'
  },
  
  ka_sons: {
    id: 'ka_sons',
    name: 'KA Sons',
    type: 'fish',
    categories: ['sea-water-fish', 'fresh-water-fish', 'steak-fish'],
    commissionRates: {
      'Sea Water Fish': 0.07,
      'Fresh Water Fish': 0.07,
      'Steak Fish': 0.07
    },
    markupRates: {
      'Sea Water Fish': 0.05,
      'Fresh Water Fish': 0.05,
      'Steak Fish': 0.05
    },
    orderSheetTab: 'KA_Sons',
    fishSheetTab: 'KA_Sons'
  },
  
  alif: {
    id: 'alif',
    name: 'Alif',
    type: 'fish',
    categories: ['sea-water-fish', 'fresh-water-fish', 'steak-fish'],
    commissionRates: {
      'Sea Water Fish': 0.10,
      'Fresh Water Fish': 0.10,
      'Steak Fish': 0.10
    },
    markupRates: {
      'Sea Water Fish': 0.05,
      'Fresh Water Fish': 0.05,
      'Steak Fish': 0.05
    },
    orderSheetTab: 'Alif',
    fishSheetTab: 'Alif'
  },
  
  // Test Butchers
  test_meat: {
    id: 'test_meat',
    name: 'Test Meat Butcher',
    type: 'meat',
    categories: ['chicken', 'mutton'],
    commissionRates: {
      'Chicken': 0.10,
      'Mutton': 0.10
    },
    markupRates: {
      'Chicken': 0.05,
      'Mutton': 0.00
    },
    orderSheetTab: 'Test_Meat_Butcher',
    meatSheetTab: 'Test_Meat_Butcher'
  },
  
  test_fish: {
    id: 'test_fish',
    name: 'Test Fish Butcher',
    type: 'fish',
    categories: ['sea-water-fish', 'fresh-water-fish', 'steak-fish'],
    commissionRates: {
      'Sea Water Fish': 0.07,
      'Fresh Water Fish': 0.07,
      'Steak Fish': 0.07
    },
    markupRates: {
      'Sea Water Fish': 0.05,
      'Fresh Water Fish': 0.05,
      'Steak Fish': 0.05
    },
    orderSheetTab: 'Test_Fish_Butcher',
    fishSheetTab: 'Test_Fish_Butcher'
  }
  
  // Mixed butchers will be added here when needed
  // Example:
  // mixed_1: {
  //   id: 'mixed_1',
  //   name: 'Mixed Butcher',
  //   type: 'mixed',
  //   categories: ['chicken', 'mutton', 'sea-water-fish', 'fresh-water-fish', 'steak-fish'],
  //   commissionRates: {
  //     'Chicken': 0.10,
  //     'Mutton': 0.12,
  //     'Sea Water Fish': 0.07,
  //     'Fresh Water Fish': 0.07,
  //     'Steak Fish': 0.07
  //   },
  //   orderSheetTab: 'Mixed_Butcher',
  //   meatSheetTab: 'Mixed_1_Meat',
  //   fishSheetTab: 'Mixed_1_Fish'
  // }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get butcher configuration (without password)
 */
export function getButcherConfig(butcherId: string): ButcherConfig | null {
  return BUTCHER_CONFIGS[butcherId] || null;
}

/**
 * Get butcher type
 */
export function getButcherType(butcherId: string): 'meat' | 'fish' | 'mixed' | null {
  const config = getButcherConfig(butcherId);
  return config?.type || null;
}

/**
 * Get butcher password
 */
export function getButcherPassword(butcherId: string): string | null {
  return BUTCHER_PASSWORDS[butcherId] || null;
}

/**
 * Extract English name from three-language format
 * Format: "Manglish - English - Malayalam" -> "English"
 */
export function extractEnglishName(fullName: string): string {
  if (fullName.includes(' - ') && fullName.split(' - ').length >= 3) {
    const parts = fullName.split(' - ');
    return parts[1].trim(); // English name is in the middle
  }
  // If not three-language format, return as is (for meat products)
  return fullName.trim();
}

/**
 * Find category for an item by matching item name
 * Returns category name (e.g., "Chicken", "Sea Water Fish") or null
 */
export function findCategoryForItem(butcherId: string, itemName: string): string | null {
  const config = getButcherConfig(butcherId);
  if (!config) return null;
  
  // Extract English name from three-language format
  const englishName = extractEnglishName(itemName).toLowerCase();
  
  // Search through all categories assigned to this butcher
  for (const categoryId of config.categories) {
    const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    if (!category) continue;
    
    // Check if any item in this category matches
    for (const item of category.items) {
      const itemEnglishName = extractEnglishName(item.name).toLowerCase();
      if (itemEnglishName === englishName) {
        return category.name; // Return category name
      }
    }
  }
  
  return null;
}

/**
 * Get item type (meat or fish) from category name
 */
export function getItemTypeFromCategory(categoryName: string): 'meat' | 'fish' | null {
  const meatCategories = ['Chicken', 'Mutton', 'Beef'];
  const fishCategories = ['Sea Water Fish', 'Fresh Water Fish', 'Steak Fish'];
  
  if (meatCategories.includes(categoryName)) return 'meat';
  if (fishCategories.includes(categoryName)) return 'fish';
  return null;
}

/**
 * Get price sheet tab name for a butcher and item category
 */
export function getPriceSheetTab(butcherId: string, categoryName: string): string | null {
  const config = getButcherConfig(butcherId);
  if (!config) return null;
  
  const butcherType = config.type;
  
  // For meat/fish butchers, return their single tab
  if (butcherType === 'meat') return config.meatSheetTab || null;
  if (butcherType === 'fish') return config.fishSheetTab || null;
  
  // For mixed butchers, determine from category
  if (butcherType === 'mixed') {
    const itemType = getItemTypeFromCategory(categoryName);
    if (itemType === 'meat') return config.meatSheetTab || null;
    if (itemType === 'fish') return config.fishSheetTab || null;
  }
  
  return null;
}

/**
 * Get commission rate for a butcher and category
 * Returns 0 if not found (with error log) - doesn't break flow
 */
export function getCommissionRate(butcherId: string, categoryName: string): number {
  const config = getButcherConfig(butcherId);
  if (!config) {
    console.error(`[ERROR] Butcher config not found for '${butcherId}'. Commission rate set to 0.`);
    return 0;
  }
  
  // Try exact match first
  let rate = config.commissionRates[categoryName];
  
  // Try case-insensitive match
  if (rate === undefined) {
    const categoryLower = categoryName.toLowerCase();
    for (const [key, value] of Object.entries(config.commissionRates)) {
      if (key.toLowerCase() === categoryLower) {
        rate = value;
        break;
      }
    }
  }
  
  // If still not found, log error and return 0
  if (rate === undefined) {
    console.error(`[ERROR] Commission rate not found for butcher='${butcherId}', category='${categoryName}'. Revenue will be 0. Please configure the rate in butcherConfig.ts.`);
    return 0;
  }
  
  return rate;
}

/**
 * Get markup rate for a butcher and category
 * Returns default based on category if not found
 */
export function getMarkupRate(butcherId: string, categoryName: string): number {
  const config = getButcherConfig(butcherId);
  if (!config) {
    // Default markup
    return 0.05;
  }
  
  // Try exact match first
  let rate = config.markupRates?.[categoryName];
  
  // Try case-insensitive match
  if (rate === undefined && config.markupRates) {
    const categoryLower = categoryName.toLowerCase();
    for (const [key, value] of Object.entries(config.markupRates)) {
      if (key.toLowerCase() === categoryLower) {
        rate = value;
        break;
      }
    }
  }
  
  // If not found, use defaults based on category
  if (rate === undefined) {
    const categoryLower = categoryName.toLowerCase();
    // Beef and mutton have 0% markup by default
    if (categoryLower === 'beef' || categoryLower === 'mutton' || 
        categoryLower.includes('beef') || categoryLower.includes('mutton')) {
      return 0.00;
    }
    // All other items have 5% markup by default
    return 0.05;
  }
  
  return rate;
}

/**
 * Get menu categories for a butcher (only assigned categories)
 */
export function getButcherMenuCategories(butcherId: string): MenuCategory[] {
  const config = getButcherConfig(butcherId);
  if (!config) return [];
  
  const categories: MenuCategory[] = [];
  
  for (const categoryId of config.categories) {
    const category = CATEGORIES[categoryId as keyof typeof CATEGORIES];
    if (category) {
      categories.push({
        id: category.id as string,
        name: category.name,
        items: Array.from(category.items) as MenuItem[]
      });
    }
  }
  
  return categories;
}

/**
 * Check if a butcher is a fish butcher (for backward compatibility)
 */
export function isFishButcher(butcherId: string): boolean {
  return getButcherType(butcherId) === 'fish';
}

/**
 * Check if a butcher is a meat butcher (for backward compatibility)
 */
export function isMeatButcher(butcherId: string): boolean {
  return getButcherType(butcherId) === 'meat';
}

/**
 * Check if a butcher is a mixed butcher
 */
export function isMixedButcher(butcherId: string): boolean {
  return getButcherType(butcherId) === 'mixed';
}

/**
 * Get fish item full name (for backward compatibility with existing code)
 * Mapping: English name -> Full three-language name
 */
const FISH_NAME_MAPPING: Record<string, string> = {
  'Mackerel': 'Ayala - Mackerel - അയല',
  'Sardine': 'Mathi - Sardine - മത്തി',
  'Prawns': 'Chemmeen - Prawns - ചെമ്മീൻ',
  'Tiger Prawns': 'Tiger Chemmeen - Tiger Prawns - ടൈഗർ ചെമ്മീൻ',
  'Naran Prawns': 'Naran Chemmeen - Naran Prawns - നരൻ ചെമ്മീൻ',
  'Anchovy': 'Nethal - Anchovy - നെത്തൾ',
  'Bullseye': 'Chemballi - Bullseye - ചെമ്പല്ലി',
  'Pink Perch': 'Kilimeen - Pink Perch - കിളിമീൻ',
  'Pony Fish': 'Mullan - Pony Fish - മുള്ളൻ',
  'CD Pony Fish': 'CD Mullan - CD Pony Fish - CD മുള്ളൻ',
  'Sole Fish': 'Manthal - Sole Fish - മാന്തൾ',
  'Emperor': 'Velameen - Emperor - വെളമീൻ',
  'Black Pomfret': 'Black Aavoli - Black Pomfret - ആവോലി',
  'White Pomfret': 'Vella Aavoli - White Pomfret - വെള്ള ആവോലി',
  'Silver Pomfret': 'Silver Aavoli - Silver Pomfret - സിൽവർ ആവോലി',
  'Kera': 'Kera - Kera - കേര',
  'Shark': 'Sravu - Shark - സ്രാവ്',
  'Trevally': 'Vatta - Trevally - വറ്റ',
  'Hamour': 'Hamour - Hamour - ഹമൂർ',
  'Red Snapper': 'Red Snapper - Red Snapper - റെഡ് സ്‌നാപ്പർ',
  'White Snapper': 'White Snapper - White Snapper - വൈറ്റ് സ്നാപ്പർ',
  'Yellow Snapper': 'Yellow Snapper - Yellow Snapper - യെല്ലോ സ്‌നാപ്പർ',
  'Squid': 'Koonthal - Squid - കൂന്തൾ',
  'Tuna': 'Choora - Tuna - ചൂര',
  'White Tuna': 'Vella Choora - White Tuna - വെള്ള ചൂര',
  'Kazhanthan Prawns': 'Kazhanthan Chemmeen - Kazhanthan Prawns - കഴന്തൻ ചെമ്മീൻ',
  'Crab': 'Nandu - Crab - നണ്ട്',
  'emperor': 'Eari - Emperor - ഏരി',
  'Clam': 'Kakka - Clam - കക്ക',
  'Sea Bass': 'Kalanji - Sea Bass - കാളാഞ്ചി',
  'Milk Fish': 'Poomeen - Milk Fish - പൂമീൻ',
  'King Fish': 'Aykora - King Fish - അയ്‌കോറ',
  'Indian Mackerel': 'Ayalakanni - Indian Mackerel - അയലകണ്ണി',
  'Silver Mullet': 'Kanambu - Silver Mullet - കണമ്പ്',
  'Cat Fish': 'Etta - Cat Fish - ഏട്ട',
  'White Sardine': 'Veloori - White Sardine - വേളൂരി',
  'Silver Belly': 'Velladavu - Silver Belly - വെള്ളടവ്',
  'Baraccuda': 'Sheelavu - Baraccuda - ഷീലാവ്',
  'Gar Fish': 'Kolaan - Gar Fish - കോലാൻ',
  'Kozhuva': 'Kozhuva - Anchovy - കൊഴുവ',
  'Chala Sardine': 'Chala Mathi - Chala Sardine - ചാളമത്തി',
  'Halibut': 'Aayiram Palli - Halibut - ആയിരംപല്ലി',
  'Ruben Fish': 'Thalayan - Ruben Fish - തളയൻ',
  'Chemban Mackerel': 'Ayalachembaan - Chemban Mackerel - അയല ചെമ്പാൻ',
  'White Trevally': 'Vella Vatta - White Trevally - വെള്ള വറ്റ',
  'White Prawns': 'Vella Chemmeen - White Prawns - വെള്ള ചെമ്മീൻ',
  'Basa Fish': 'Dam Vaala - Basa Fish - ഡാം വാള',
  'Pearl Spot': 'Karimeen - Pearl Spot - കരിമീൻ',
  'Tilapia': 'Silopia - Tilapia - സിലോപ്യ',
  'Dam Carp': 'Dam Katla - Dam Carp - ഡാം കട്ടള',
  'Dam Labeo': 'Dam Roohu - Dam Labeo - ഡാം റൂഹ്',
  'Dam Pomfret': 'Dam Aavoli - Dam Pomfret - ഡാം ആവോലി',
  'Kadal Kannan': 'Kadal Kannan - Kadal Kannan - കടൽ കണ്ണൻ',
  'Snake Head': 'Varal - Snake Head - വരാൽ',
  'Boal': 'Aattu Vaala - Boal - ആറ്റു വാള',
  'otti butter fish meat': 'Otti Modha Meat - Otti Butter Fish Meat - ഓട്ടി മോദ',
  'butter fish meat': 'Modha Meat - Butter Fish Meat - മോദ',
  'sail fish meat': 'Ola Neymeen Meat - Sail Fish Meat - ഓല നെയ്മീൻ',
  'string ray meat': 'Therandi Meat - String Ray Meat - തെരണ്ടി',
  'shark meat': 'Sravu Meat - Shark Meat - സ്രാവ്',
  'trevally meat': 'Vatta Meat - Trevally Meat - വറ്റ',
  'milk fish meat': 'Poomeen Meat - Milk Fish Meat - പൂമീൻ',
  'cat fish meat': 'Etta Meat - Cat Fish Meat - ഏട്ട',
  'kera meat': 'Kera Meat - Kera Meat - കേര',
  'king fish meat': 'Aykora Meat - King Fish Meat - അയ്‌കോറ'
};

export function getFishItemFullName(englishName: string): string {
  // First try exact match
  if (FISH_NAME_MAPPING[englishName]) {
    return FISH_NAME_MAPPING[englishName];
  }
  
  // Try case-insensitive match
  const lowerCaseName = englishName.toLowerCase();
  for (const [key, value] of Object.entries(FISH_NAME_MAPPING)) {
    if (key.toLowerCase() === lowerCaseName) {
      return value;
    }
  }
  
  // If no match found, return original name
  return englishName;
}

// ============================================================================
// DEFAULT BUTCHER RATES (for backward compatibility with sheet operations)
// ============================================================================

import type { ButcherRates } from './types';

/**
 * Get all butcher rates with default values from config
 * Used for initializing rates in Google Sheets
 */
export function getDefaultButcherRates(): ButcherRates[] {
  const butcherIds = Object.keys(BUTCHER_CONFIGS);
  
  return butcherIds.map(butcherId => {
    const config = getButcherConfig(butcherId);
    if (!config) {
      return {
        butcherId,
        butcherName: butcherId,
        commissionRates: [],
        markupRates: []
      };
    }
    
    // Convert commissionRates from Record to CommissionRate[]
    const commissionRates = Object.entries(config.commissionRates).map(([category, rate]) => ({
      butcherId,
      category,
      rate
    }));
    
    // Convert markupRates from Record to MarkupRate[]
    const markupRates = Object.entries(config.markupRates || {}).map(([category, rate]) => ({
      butcherId,
      category,
      rate
    }));
    
    return {
      butcherId,
      butcherName: config.name,
      commissionRates,
      markupRates
    };
  });
}

// ============================================================================
// FRESH BUTCHERS ARRAY
// ============================================================================

/**
 * Generate butchers array from butcher config
 * Creates Butcher[] objects with menu data from config
 */
export const freshButchers: Butcher[] = (() => {
  const butcherIds = [
    'usaj',
    'usaj_mutton',
    'pkd',
    'kak',
    'ka_sons',
    'alif',
    'test_meat',
    'test_fish'
  ];

  return butcherIds.map(butcherId => {
    const config = getButcherConfig(butcherId);
    const password = getButcherPassword(butcherId);
    
    if (!config) {
      throw new Error(`Butcher config not found for: ${butcherId}`);
    }

    return {
      id: config.id as Butcher['id'],
      name: config.name,
      password: password || 'password', // Fallback to 'password' if not found
      menu: getButcherMenuCategories(butcherId)
    };
  });
})();
