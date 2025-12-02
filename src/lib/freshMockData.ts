// Fresh import of mock data with cache busting
// This file ensures we always get the latest menu data

import type { Butcher, MenuCategory } from './types';

// Helper to create a default size for items
const defaultSize = (price: number = 0) => [{ id: `s-${Math.random()}`, size: 'default' as const, price }];

// Helper to create all three sizes for fish items (Small, Medium, Large)
const fishSizes = (smallPrice: number = 0, mediumPrice: number = 0, largePrice: number = 0) => [
  { id: `s-${Math.random()}`, size: 'small' as const, price: smallPrice },
  { id: `s-${Math.random()}`, size: 'medium' as const, price: mediumPrice },
  { id: `s-${Math.random()}`, size: 'big' as const, price: largePrice }
];

// Helper to create menu items with unavailable status by default
const createUnavailableItem = (id: string, name: string, unit: 'kg' | 'nos', sizes: any[]) => ({
  id,
  name,
  unit,
  available: false, // Set all items as unavailable by default
  sizes
});

const createFishMenu = (): MenuCategory[] => [
  { id: 'cat-sea', name: 'Sea Water Fish', items: [
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
  ]},
  { id: 'cat-fresh', name: 'Fresh Water Fish', items: [
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
  ]},
  { id: 'cat-meat', name: 'Meat Items', items: [
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
  ]}
];

export const freshButchers: Butcher[] = [
  {
    id: 'usaj',
    name: 'Usaj',
    password: 'password',
    menu: [
      { id: 'c1', name: 'Chicken', items: [
        createUnavailableItem('c1i1', 'chicken leg', 'kg', defaultSize()),
        createUnavailableItem('c1i3', 'chicken meat', 'kg', defaultSize()),
        createUnavailableItem('c1i4', 'chicken breast bone', 'kg', defaultSize()),
        createUnavailableItem('c1i5', 'chicken breast boneless', 'kg', defaultSize()),
        createUnavailableItem('c1i6', 'chicken lollipop', 'kg', defaultSize()),
        createUnavailableItem('c1i7', 'chicken parts', 'kg', defaultSize()),
        createUnavailableItem('c1i8', 'chicken nadan', 'kg', defaultSize()),
        createUnavailableItem('c1i9', 'chicken thigh', 'kg', defaultSize()),
      ]},
      { id: 'c2', name: 'Mutton', items: [
        createUnavailableItem('c2i1', 'mutton meat', 'kg', defaultSize()),
        createUnavailableItem('c2i2', 'mutton rib', 'kg', defaultSize()),
        createUnavailableItem('c2i3', 'mutton boneless', 'kg', defaultSize()),
        createUnavailableItem('c2i4', 'mutton liver', 'kg', defaultSize()),
        createUnavailableItem('c2i5', 'mutton brain', 'nos', defaultSize()),
        createUnavailableItem('c2i6', 'mutton head', 'kg', defaultSize()),
        createUnavailableItem('c2i7', 'mutton botty', 'kg', defaultSize()),
        createUnavailableItem('c2i8', 'mutton paaya', 'kg', defaultSize()),
      ]},
      { id: 'c3', name: 'Beef', items: [
        createUnavailableItem('c3i1', 'beef meat', 'kg', defaultSize()),
        createUnavailableItem('c3i2', 'beef liver', 'kg', defaultSize()),
      ]}
    ]
  },
  {
    id: 'usaj_mutton',
    name: 'Usaj Mutton Shop',
    password: 'password',
    menu: [
      { id: 'm1', name: 'Mutton', items: [
        createUnavailableItem('m1i1', 'Mutton meat', 'kg', defaultSize()),
        createUnavailableItem('m1i2', 'Mutton liver', 'kg', defaultSize()),
        createUnavailableItem('m1i3', 'Mutton botty', 'kg', defaultSize()),
        createUnavailableItem('m1i4', 'Mutton boneless', 'kg', defaultSize()),
        createUnavailableItem('m1i5', 'Mutton rib', 'kg', defaultSize()),
        createUnavailableItem('m1i6', 'Mutton brain', 'nos', defaultSize()),
        createUnavailableItem('m1i7', 'Mutton paaya', 'kg', defaultSize())
      ]}
    ]
  },
  {
    id: 'pkd',
    name: 'PKD Stall',
    password: 'password',
    menu: [
       { id: 'p1', name: 'Chicken', items: [
        createUnavailableItem('p1i1', 'chicken leg', 'kg', defaultSize()),
        createUnavailableItem('p1i3', 'chicken meat', 'kg', defaultSize()),
        createUnavailableItem('p1i4', 'chicken breast bone', 'kg', defaultSize()),
        createUnavailableItem('p1i5', 'chicken breast boneless', 'kg', defaultSize()),
        createUnavailableItem('p1i6', 'chicken lollipop', 'kg', defaultSize()),
        createUnavailableItem('p1i7', 'chicken parts', 'kg', defaultSize()),
        createUnavailableItem('p1i8', 'chicken nadan', 'kg', defaultSize()),
        createUnavailableItem('p1i9', 'chicken thigh', 'kg', defaultSize()),
      ]},
       { id: 'p2', name: 'Mutton', items: [
        createUnavailableItem('p2i1', 'mutton meat', 'kg', defaultSize()),
        createUnavailableItem('p2i2', 'mutton rib', 'kg', defaultSize()),
        createUnavailableItem('p2i3', 'mutton boneless', 'kg', defaultSize()),
        createUnavailableItem('p2i4', 'mutton liver', 'kg', defaultSize()),
        createUnavailableItem('p2i5', 'mutton brain', 'nos', defaultSize()),
        createUnavailableItem('p2i6', 'mutton head', 'kg', defaultSize()),
        createUnavailableItem('p2i7', 'mutton botty', 'kg', defaultSize()),
        createUnavailableItem('p2i8', 'mutton paaya', 'kg', defaultSize()),
      ]}
    ]
  },
  {
    id: 'kak',
    name: 'KAK',
    password: 'password',
    menu: createFishMenu()
  },
  {
    id: 'ka_sons',
    name: 'KA Sons',
    password: 'password',
    menu: createFishMenu()
  },
  {
    id: 'alif',
    name: 'Alif',
    password: 'password',
    menu: createFishMenu()
  },
  {
    id: 'test_meat',
    name: 'Test Meat Butcher',
    password: 'test',
    menu: [
      { id: 'c1', name: 'Chicken', items: [
        createUnavailableItem('c1i1', 'chicken leg', 'kg', defaultSize()),
        createUnavailableItem('c1i3', 'chicken meat', 'kg', defaultSize()),
        createUnavailableItem('c1i4', 'chicken breast bone', 'kg', defaultSize()),
        createUnavailableItem('c1i5', 'chicken breast boneless', 'kg', defaultSize()),
        createUnavailableItem('c1i6', 'chicken lollipop', 'kg', defaultSize()),
        createUnavailableItem('c1i7', 'chicken parts', 'kg', defaultSize()),
        createUnavailableItem('c1i8', 'chicken nadan', 'kg', defaultSize()),
        createUnavailableItem('c1i9', 'chicken thigh', 'kg', defaultSize()),
      ]},
      { id: 'c2', name: 'Mutton', items: [
        createUnavailableItem('c2i1', 'mutton meat', 'kg', defaultSize()),
        createUnavailableItem('c2i2', 'mutton rib', 'kg', defaultSize()),
        createUnavailableItem('c2i3', 'mutton boneless', 'kg', defaultSize()),
      ]}
    ]
  },
  {
    id: 'test_fish',
    name: 'Test Fish Butcher',
    password: 'test',
    menu: createFishMenu()
  }
];

// Mapping for fish butchers: English name -> Full three-language name
const FISH_NAME_MAPPING: Record<string, string> = {
  // Sea Water Fish
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
  'Eari': 'Eari - Emperor - ഏരി',
  'Clam': 'Kakka - Clam - കക്ക',
  'Sea Bass': 'Kalanji - Sea Bass - കാളാഞ്ചി',
  'Milk Fish': 'Poomeen - Milk Fish - പൂമീൻ',
  'King Fish': 'Aykora - King Fish - അയ്‌കോറ',
  'Ayalakanni': 'Ayalakanni - Indian Mackerel - അയലകണ്ണി',
  'Silver Mullet': 'Kanambu - Silver Mullet - കണമ്പ്',
  'Cat Fish': 'Etta - Cat Fish - ഏട്ട',
  'White Sardine': 'Veloori - White Sardine - വേളൂരി',
  'Velladavu': 'Velladavu - Silver Belly - വെള്ളടവ്',
  'Baraccuda': 'Sheelavu - Baraccuda - ഷീലാവ്',
  'Gar Fish': 'Kolaan - Gar Fish - കോലാൻ',
  'Kozhuva': 'Kozhuva - Anchovy - കൊഴുവ',
  'Chala Sardine': 'Chala Mathi - Chala Sardine - ചാളമത്തി',
  'Halibut': 'Aayiram Palli - Halibut - ആയിരംപല്ലി',
  'Ruben Fish': 'Thalayan - Ruben Fish - തളയൻ',
  'Chemban Mackerel': 'Ayalachembaan - Chemban Mackerel - അയല ചെമ്പാൻ',
  'White Trevally': 'Vella Vatta - White Trevally - വെള്ള വറ്റ',
  
  // Fresh Water Fish
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
  
  // Meat Items with "meat" suffix (for fish butchers)
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

// Function to get full three-language name for fish items
export const getFishItemFullName = (englishName: string): string => {
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
};

// Function to check if a butcher is a fish butcher
export const isFishButcher = (butcherId: string): boolean => {
  return ['kak', 'ka_sons', 'alif', 'test_fish'].includes(butcherId);
};
