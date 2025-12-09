/**
 * Butcher Name Mapping System
 * Maps Central API butcher names to internal butcher IDs and sheet tab names
 */

export interface ButcherMapping {
  butcherId: string;
  sheetTab: string;
}

// Mapping: Central API Name → Butcher ID → Sheet Tab Name
const BUTCHER_MAPPING: Record<string, ButcherMapping> = {
  'Usaj Meat Hub': {
    butcherId: 'usaj',
    sheetTab: 'Usaj_Meat_Hub'
  },
  'PKD Stall': {
    butcherId: 'pkd',
    sheetTab: 'PKD_Stall'
  },
  'Alif': {
    butcherId: 'alif',
    sheetTab: 'Alif'
  },
  'KAK': {
    butcherId: 'kak',
    sheetTab: 'KAK'
  },
  'KA Sons': {
    butcherId: 'ka_sons',
    sheetTab: 'KA_Sons'
  },
  'Usaj Mutton Shop': {
    butcherId: 'usaj_mutton',
    sheetTab: 'Usaj_Mutton_Shop'
  },
  'Test Meat Butcher': {
    butcherId: 'test_meat',
    sheetTab: 'Test_Meat_Butcher'
  },
  'Test Fish Butcher': {
    butcherId: 'test_fish',
    sheetTab: 'Test_Fish_Butcher'
  },
  'Tender Chops': {
    butcherId: 'tender_chops',
    sheetTab: 'Tender_Chops'
  }
};

/**
 * Get butcher ID from Central API butcher name
 */
export function getButcherIdFromName(butcherName: string): string | null {
  const mapping = BUTCHER_MAPPING[butcherName];
  return mapping ? mapping.butcherId : null;
}

/**
 * Get sheet tab name from Central API butcher name
 */
export function getSheetTabFromName(butcherName: string): string | null {
  const mapping = BUTCHER_MAPPING[butcherName];
  return mapping ? mapping.sheetTab : null;
}

/**
 * Get Central API butcher name from butcher ID
 */
export function getButcherNameFromId(butcherId: string): string | null {
  for (const [name, mapping] of Object.entries(BUTCHER_MAPPING)) {
    if (mapping.butcherId === butcherId) {
      return name;
    }
  }
  return null;
}

/**
 * Get all available butcher names from Central API
 */
export function getAllButcherNames(): string[] {
  return Object.keys(BUTCHER_MAPPING);
}

/**
 * Check if butcher name is valid
 */
export function isValidButcherName(butcherName: string): boolean {
  return butcherName in BUTCHER_MAPPING;
}

