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
    { id: 'i-manthal', name: 'Manthal - Sole Fish - മാന്തൾ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-velameen', name: 'Velameen - Emperor - വെളമീൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-blackaavoli', name: 'Black Aavoli - Black Pomfret - ആവോലി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-vellaaavoli', name: 'Vella Aavoli - White Pomfret - വെള്ള ആവോലി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-silveraavoli', name: 'Silver Aavoli - Silver Pomfret - സിൽവർ ആവോലി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kera', name: 'Kera - Kera - കേര', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-sravu-sea', name: 'Sravu - Shark - സ്രാവ്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-vatta-sea', name: 'Vatta - Trevally - വറ്റ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-hamour', name: 'Hamour - Hamour - ഹമൂർ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-redsnapper', name: 'Red Snapper - Red Snapper - റെഡ് സ്‌നാപ്പർ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-whitesnapper', name: 'White Snapper - White Snapper - വൈറ്റ് സ്നാപ്പർ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-yellowsnapper', name: 'Yellow Snapper - Yellow Snapper - യെല്ലോ സ്‌നാപ്പർ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-koonthal', name: 'Koonthal - Squid - കൂന്തൾ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-choora', name: 'Choora - Tuna - ചൂര', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-vellachoora', name: 'Vella Choora - White Tuna - വെള്ള ചൂര', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kazhanthanchemmeen', name: 'Kazhanthan Chemmeen - Kazhanthan Prawns - കഴന്തൻ ചെമ്മീൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-nandu', name: 'Nandu - Crab - നണ്ട്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-eari', name: 'Eari - Emperor - ഏരി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kakka', name: 'Kakka - Clam - കക്ക', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kalanji', name: 'Kalanji - Sea Bass - കാളാഞ്ചി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-poomeen-sea', name: 'Poomeen - Milk Fish - പൂമീൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-aykora-sea', name: 'Aykora - King Fish - അയ്‌കോറ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-ayalakanni', name: 'Ayalakanni - Indian Mackerel - അയലകണ്ണി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kanambu', name: 'Kanambu - Silver Mullet - കണമ്പ്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-etta-sea', name: 'Etta - Cat Fish - ഏട്ട', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-veloori', name: 'Veloori - White Sardine - വേളൂരി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-velladavu', name: 'Velladavu - Silver Belly - വെള്ളടവ്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-sheelavu-sea', name: 'Sheelavu - Baraccuda - ഷീലാവ്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kolaan', name: 'Kolaan - Gar Fish - കോലാൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kozhuva', name: 'Kozhuva - Anchovy - കൊഴുവ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-chalamathi', name: 'Chala Mathi - Sardine ചാളമത്തി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-aayirampalli', name: 'Aayiram Palli - Halibut - ആയിരംപല്ലി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-thalayan', name: 'Thalayan - Ruben Fish - തളയൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-ayalachembaan', name: 'Ayalachembaan - mackerelll - അയല ചെമ്പാൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-vellavatta', name: 'vella vatta- വെള്ള വറ്റ - white trevally', unit: 'kg', available: false, sizes: fishSizes() }
  ]},
  { id: 'cat-fresh', name: 'Fresh Water Fish', items: [
    { id: 'i-vellachemmeen', name: 'Vella Chemmeen - White Prawns  - വെള്ള ചെമ്മീൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-damvaala', name: 'Dam Vaala - Basa Fish - ഡാം വാള', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-karimeen', name: 'Karimeen - Pearl Spot -  കരിമീൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-silopia', name: 'Silopia - Tilapia - സിലോപ്യ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-damkatla', name: 'Dam Katla - Dam Carp - ഡാം കട്ടള', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-damroohu', name: 'Dam Roohu - Dam Labeo - ഡാം റൂഹ്', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-damaavoli', name: 'Dam Aavoli - Dam Pomfret - ഡാം ആവോലി', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-kadalkannan', name: 'Murrel - Kadal Kannan - കടൽ കണ്ണൻ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-varal', name: 'Varal - Snake Head - വരാൽ', unit: 'kg', available: false, sizes: fishSizes() },
    { id: 'i-attuvaala', name: 'Aattu Vaala - Boal - ആറ്റു വാള', unit: 'kg', available: false, sizes: fishSizes() },
  ]},
  { id: 'cat-meat', name: 'Meat Items', items: [
    { id: 'i-olaneymeen', name: 'Ola Neymeen Meat - Sail Fish Meat - ഓല നെയ്മീൻ', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-sravu-meat', name: 'Sravu Meat - Shark Meat - സ്രാവ്', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-modha-meat', name: 'Modha Meat - Butter Fish Meat - മോദ', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-ottimodha-meat', name: 'Otti Modha Meat - Otti Butter Fish Meat - ഓട്ടി മോദ', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-vatta-meat', name: 'Vatta Meat - Trevally Meat - വറ്റ', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-poomeen-meat', name: 'Poomeen Meat - Milk Fish Meat - പൂമീൻ', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-etta-meat', name: 'Etta Meat - Cat Fish Meat - ഏട്ട', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-therandi', name: 'Therandi Meat - String Ray Meat - തെരണ്ടി', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-kera-meat', name: 'Kera Meat - Kera Meat - കേര', unit: 'kg', available: false, sizes: defaultSize() },
    { id: 'i-aykora-meat', name: 'Aykora Meat - King Fish Meat - അയ്‌കോറ', unit: 'kg', available: false, sizes: defaultSize() },
  ]}
];

export const freshButchers: Butcher[] = [
  {
    id: 'usaj',
    name: 'Usaj',
    password: 'password',
    menu: [
      { id: 'c1', name: 'Chicken', items: [
        { id: 'c1i1', name: 'chicken leg', unit: 'kg', available: false, sizes: defaultSize() },
        //{ id: 'c1i2', name: 'chicken whole', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i3', name: 'chicken meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i4', name: 'chicken breast bone', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i5', name: 'chicken breast boneless', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i6', name: 'chicken lollipop', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i7', name: 'chicken parts', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i8', name: 'chicken nadan', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c1i9', name: 'chicken thigh', unit: 'kg', available: false, sizes: defaultSize() },
      ]},
      { id: 'c2', name: 'Mutton', items: [
        { id: 'c2i1', name: 'mutton meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i2', name: 'mutton rib', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i3', name: 'mutton boneless', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i4', name: 'mutton liver', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i5', name: 'mutton brain', unit: 'nos', available: false, sizes: defaultSize() },
        { id: 'c2i6', name: 'mutton head', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i7', name: 'mutton botty', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c2i8', name: 'mutton paaya', unit: 'kg', available: false, sizes: defaultSize() },
      ]},
      { id: 'c3', name: 'Beef', items: [
        { id: 'c3i1', name: 'beef meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'c3i2', name: 'beef liver', unit: 'kg', available: false, sizes: defaultSize() },
      ]}
    ]
  },
  {
    id: 'usaj_mutton',
    name: 'Usaj Mutton Shop',
    password: 'password',
    menu: [
      { id: 'm1', name: 'Mutton', items: [
        { id: 'm1i1', name: 'Mutton meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'm1i2', name: 'Mutton liver', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'm1i3', name: 'Mutton botty', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'm1i4', name: 'Mutton boneless', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'm1i5', name: 'Mutton rib', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'm1i6', name: 'Mutton brain', unit: 'nos', available: false, sizes: defaultSize() },
        { id: 'm1i7', name: 'Mutton paaya', unit: 'kg', available: false, sizes: defaultSize() }
      ]}
    ]
  },
  {
    id: 'pkd',
    name: 'PKD Stall',
    password: 'password',
    menu: [
       { id: 'p1', name: 'Chicken', items: [
        { id: 'p1i1', name: 'chicken leg', unit: 'kg', available: false, sizes: defaultSize() },
        //{ id: 'p1i2', name: 'chicken whole', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i3', name: 'chicken meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i4', name: 'chicken breast bone', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i5', name: 'chicken breast boneless', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i6', name: 'chicken lollipop', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i7', name: 'chicken parts', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i8', name: 'chicken nadan', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p1i9', name: 'chicken thigh', unit: 'kg', available: false, sizes: defaultSize() },
      ]},
       { id: 'p2', name: 'Mutton', items: [
        { id: 'p2i1', name: 'mutton meat', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i2', name: 'mutton rib', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i3', name: 'mutton boneless', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i4', name: 'mutton liver', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i5', name: 'mutton brain', unit: 'nos', available: false, sizes: defaultSize() },
        { id: 'p2i6', name: 'mutton head', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i7', name: 'mutton botty', unit: 'kg', available: false, sizes: defaultSize() },
        { id: 'p2i8', name: 'mutton paaya', unit: 'kg', available: false, sizes: defaultSize() },
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
  'Ayalakanni': 'Ayalakanni - Mackerel - അയലകണ്ണി',
  'Silver Mullet': 'Kanambu - Silver Mullet - കണമ്പ്',
  'Cat Fish': 'Etta - Cat Fish - ഏട്ട',
  'White Sardine': 'Veloori - White Sardine - വേളൂരി',
  'Velladavu': 'Velladavu - Sea',
  'Baraccuda': 'Sheelavu - Baraccuda - ഷീലാവ്',
  'Gar Fish': 'Kolaan - Gar Fish - കോലാൻ',
  'Kozhuva': 'Kozhuva - Anchovy - കൊഴുവ',
  'Chala Mathi': 'Chala Mathi - Sardine - ചാളമത്തി',
  'Halibut': 'Aayiram Palli - Halibut - ആയിരംപല്ലി',
  'Ruben Fish': 'Thalayan - Ruben Fish - തളയൻ',
  'mackerelll': 'Ayalachembaan - mackerelll - അയല ചെമ്പാൻ',
  'white trevally': 'vella vatta- വെള്ള വറ്റ - white trevally',
  
  // Fresh Water Fish
  'White Prawns': 'Vella Chemmeen - White Prawns - വെള്ള ചെമ്മീൻ',
  'Baasa Fish': 'Dam Vaala - Baasa Fish - ഡാം വാള',
  'Pearl Spot': 'Karimeen - Pearl Spot - കരിമീൻ',
  'Tilapia': 'Silopia - Tilapia - സിലോപ്യ',
  'Dam Carp': 'Dam Katla - Dam Carp - ഡാം കട്ടള',
  'Dam Labeo': 'Dam Roohu - Dam Labeo - ഡാം റൂഹ്',
  'Dam Pomfret': 'Dam Aavoli - Dam Pomfret - ഡാം ആവോലി',
  'Kadal Kannan': 'Kadal Kannan - Kadal Kannan - കടൽ കണ്ണൻ',
  'Snake Head': 'Varal - Snake Head - വരാൽ',
  'Boal': 'Aattu Vaala - Boal - ആറ്റു വാള',
  
  // Meat Items
  'Sail Fish': 'Ola Neymeen - Sail Fish - ഓല നെയ്മീൻ',
  'Butter Fish': 'Modha - Butter Fish - മോദ',
  'otty Butter Fish': 'Otti Modha - otty Butter Fish - ഓട്ടി മോദ',
  'String Ray': 'Therandi - String Ray - തെരണ്ടി',
  
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
  return ['kak', 'ka_sons', 'alif'].includes(butcherId);
};
