
import type { Butcher, Order, MenuCategory } from './types';

// Helper to create a default size for items
const defaultSize = (price: number = 0) => [{ id: `s-${Math.random()}`, size: 'default' as const, price }];
const pieceSize = (price: number = 0, minWeight: number, maxWeight: number) => [{ id: `s-${Math.random()}`, size: 'default' as const, price, minWeight, maxWeight }];

const createFishMenu = (): MenuCategory[] => JSON.parse(JSON.stringify([
  { id: 'cat-sea', name: 'Sea Water Fish', items: [
    { id: 'i-ayala', name: 'Ayala - Mackerel - അയല', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-mathi', name: 'Mathi - Sardine - മത്തി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-chemmeen', name: 'Chemmeen - Prawns - ചെമ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-tigerchemmeen', name: 'Tiger Chemmeen - Tiger Prawns - ടൈഗർ ചെമ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-naranchemmeen', name: 'Naran Chemmeen - Naran Prawns - നരൻ ചെമ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-nethal', name: 'Nethal - Anchovy - നെത്തൾ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-chemballi', name: 'Chemballi - Bullseye - ചെമ്പല്ലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kilimeen', name: 'Kilimeen - Pink Perch - കിളിമീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-mullan', name: 'Mullan - Pony Fish - മുള്ളൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-cdmullan', name: 'CD Mullan - CD Pony Fish - CD മുള്ളൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-manthal', name: 'Manthal - Sole Fish - മാന്തൾ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-velameen', name: 'Velameen - Emperor - വെളമീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-blackaavoli', name: 'Black Aavoli - Black Pomfret - ആവോലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-vellaaavoli', name: 'Vella Aavoli - White Pomfret - വെള്ള ആവോലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-silveraavoli', name: 'Silver Aavoli - Silver Pomfret - സിൽവർ ആവോലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kera', name: 'Kera - Kera - കേര', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-sravu-sea', name: 'Sravu - Shark - സ്രാവ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-vatta-sea', name: 'Vatta - Trevally - വറ്റ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-hamour', name: 'Hamour - Hamour - ഹമൂർ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-redsnapper', name: 'Red Snapper - Red Snapper - റെഡ് സ്‌നാപ്പർ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-whitesnapper', name: 'White Snapper - White Snapper - വൈറ്റ് സ്നാപ്പർ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-yellowsnapper', name: 'Yellow Snapper - Yellow Snapper - യെല്ലോ സ്‌നാപ്പർ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-koonthal', name: 'Koonthal - Squid - കൂന്തൾ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-choora', name: 'Choora - Tuna - ചൂര', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-vellachoora', name: 'Vella Choora - White Tuna - വെള്ള ചൂര', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kazhanthanchemmeen', name: 'Kazhanthan Chemmeen - Kazhanthan Prawns - കഴന്തൻ ചെമ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-nandu', name: 'Nandu - Crab - നണ്ട്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-eari', name: 'Eari - Emperor - ഏരി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kakka', name: 'Kakka - Clam - കക്ക', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kalanji', name: 'Kalanji - Sea Bass - കാളാഞ്ചി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-poomeen-sea', name: 'Poomeen - Milk Fish - പൂമീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-aykora-sea', name: 'Aykora - King Fish - അയ്‌കോറ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-ayalakanni', name: 'Ayalakanni - Indian Mackerel - അയലകണ്ണി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kanambu', name: 'Kanambu - Silver Mullet - കണമ്പ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-etta-sea', name: 'Etta - Cat Fish - ഏട്ട', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-veloori', name: 'Veloori - White Sardine - വേളൂരി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-velladavu', name: 'Velladavu - Silver Belly - വെള്ളടവ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-sheelavu-sea', name: 'Sheelavu - Baraccuda - ഷീലാവ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kolaan', name: 'Kolaan - Gar Fish - കോലാൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kozhuva', name: 'Kozhuva - Anchovy - കൊഴുവ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-chalamathi', name: 'Chala Mathi - Sardine - ചാളമത്തി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-aayirampalli', name: 'Aayiram Palli - Halibut - ആയിരംപല്ലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-thalayan', name: 'Thalayan - Ruben Fish - തളയൻ', unit: 'kg', available: true, sizes: defaultSize() },
  ]},
  { id: 'cat-fresh', name: 'Fresh Water Fish', items: [
    { id: 'i-vellachemmeen', name: 'Vella Chemmeen - White Prawns - വെള്ള ചെമ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-damvaala', name: 'Dam Vaala - Basa Fish - ഡാം വാള', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-karimeen', name: 'Karimeen - Pearl Spot - കരിമീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-silopia', name: 'Silopia - Tilapia - സിലോപ്യ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-damkatla', name: 'Dam Katla - Dam Carp - ഡാം കട്ടള', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-damroohu', name: 'Dam Roohu - Dam Labeo - ഡാം റൂഹ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-damaavoli', name: 'Dam Aavoli - Dam Pomfret - ഡാം ആവോലി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kadalkannan', name: 'Kadal Kannan - Kadal Kannan - കടൽ കണ്ണൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-varal', name: 'Varal - Snake Head - വരാൽ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-attuvaala', name: 'Aattu Vaala - Boal - ആറ്റു വാള', unit: 'kg', available: true, sizes: defaultSize() },
  ]},
  { id: 'cat-meat', name: 'Meat Items', items: [
    { id: 'i-olaneymeen', name: 'Ola Neymeen - Sail Fish - ഓല നെയ്മീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-sravu-meat', name: 'Sravu - Shark - സ്രാവ്', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-modha', name: 'Modha - Butter Fish - മോദ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-ottimodha', name: 'Otti Modha - Otti Butter Fish - ഓട്ടി മോദ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-vatta-meat', name: 'Vatta - Trevally - വറ്റ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-poomeen-meat', name: 'Poomeen - Milk Fish - പൂമീൻ', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-etta-meat', name: 'Etta - Cat fish - ഏട്ട', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-therandi', name: 'Therandi - String Ray - തെരണ്ടി', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-kera-meat', name: 'Kera - Kera - കേര', unit: 'kg', available: true, sizes: defaultSize() },
    { id: 'i-aykora-meat', name: 'Aykora - King Fish - അയ്‌കോറ', unit: 'kg', available: true, sizes: defaultSize() },
  ]}
]));


export const butchers: Butcher[] = [
  {
    id: 'usaj',
    name: 'Usaj',
    password: 'password',
    menu: [
      { id: 'c1', name: 'Chicken', items: [
        { id: 'c1i1', name: 'chicken leg', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i2', name: 'chicken whole', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i3', name: 'chicken meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i4', name: 'chicken breast bone', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i5', name: 'chicken breast boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i6', name: 'chicken lollipop', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i7', name: 'chicken parts', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i8', name: 'chicken nadan', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i9', name: 'chicken thigh', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c1i10', name: 'chicken meat with skin', unit: 'kg', available: true, sizes: defaultSize() },
      ]},
      { id: 'c2', name: 'Mutton', items: [
        { id: 'c2i1', name: 'mutton meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i2', name: 'mutton rib', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i3', name: 'mutton boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i4', name: 'mutton liver', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i5', name: 'mutton brain', unit: 'nos', available: true, sizes: defaultSize() },
        { id: 'c2i6', name: 'mutton head', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i7', name: 'mutton botty', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c2i8', name: 'mutton paaya', unit: 'kg', available: true, sizes: defaultSize() },
      ]},
      { id: 'c3', name: 'Beef', items: [
        { id: 'c3i1', name: 'beef meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c3i2', name: 'beef boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'c3i3', name: 'beef bone', unit: 'kg', available: true, sizes: defaultSize() },
      ]}
    ]
  },
  {
    id: 'usaj_mutton',
    name: 'Usaj Mutton Shop',
    password: 'password',
    menu: [
      { id: 'm1', name: 'Mutton', items: [
        { id: 'm1i1', name: 'Mutton meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'm1i2', name: 'Mutton liver', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'm1i3', name: 'Mutton botty', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'm1i4', name: 'Mutton boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'm1i5', name: 'Mutton rib', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'm1i6', name: 'Mutton brain', unit: 'nos', available: true, sizes: defaultSize() },
        { id: 'm1i7', name: 'Mutton paaya', unit: 'kg', available: true, sizes: defaultSize() }
      ]}
    ]
  },
  {
    id: 'pkd',
    name: 'PKD Stall',
    password: 'password',
    menu: [
       { id: 'p1', name: 'Chicken', items: [
        { id: 'p1i1', name: 'chicken leg', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i2', name: 'chicken whole', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i3', name: 'chicken meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i4', name: 'chicken breast bone', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i5', name: 'chicken breast boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i6', name: 'chicken lollipop', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i7', name: 'chicken parts', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i8', name: 'chicken nadan', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p1i9', name: 'chicken thigh', unit: 'kg', available: true, sizes: defaultSize() },
      ]},
       { id: 'p2', name: 'Mutton', items: [
        { id: 'p2i1', name: 'mutton meat', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i2', name: 'mutton rib', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i3', name: 'mutton boneless', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i4', name: 'mutton liver', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i5', name: 'mutton brain', unit: 'nos', available: true, sizes: defaultSize() },
        { id: 'p2i6', name: 'mutton head', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i7', name: 'mutton botty', unit: 'kg', available: true, sizes: defaultSize() },
        { id: 'p2i8', name: 'mutton paaya', unit: 'kg', available: true, sizes: defaultSize() },
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


export const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    customerName: 'John Doe',
    items: [
      { id: 'c1i1', name: 'Chicken Meat', quantity: 2, unit: 'kg', cutType: 'Small pieces' },
      { id: 'c2i2', name: 'Beef Boneless', quantity: 1, unit: 'kg', cutType: 'Medium chunks' }
    ],
    status: 'new',
    orderTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  },
  {
    id: 'ORD-002',
    customerName: 'Jane Smith',
    items: [
      { id: 'k1i1', name: 'Mathi - Sardine', quantity: 1.5, unit: 'kg', size: 'medium', cutType: 'Whole cleaned' },
    ],
    status: 'new',
    orderTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
  },
  {
    id: 'ORD-003',
    customerName: 'Peter Jones',
    items: [
      { id: 'p2i6', name: 'Mutton Paaya', quantity: 4, unit: 'nos', cutType: 'Cut into pieces' },
    ],
    status: 'preparing',
    orderTime: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    preparationStartTime: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
  },
    {
    id: 'ORD-004',
    customerName: 'Mary Williams',
    items: [
      { id: 'c3i1', name: 'Mutton Meat', quantity: 0.75, unit: 'kg', cutType: 'Curry cut' },
    ],
    status: 'prepared',
    orderTime: new Date(Date.now() - 60 * 60 * 1000),
    preparationStartTime: new Date(Date.now() - 40 * 60 * 1000),
    preparationEndTime: new Date(Date.now() - 20 * 60 * 1000),
    pickedWeight: 0.73,
    revenue: 650,
  },
  {
    id: 'ORD-005',
    customerName: 'David Brown',
    items: [
      { id: 'c1i4', name: 'Chicken Boneless', quantity: 1, unit: 'kg', cutType: 'Fry cut' }
    ],
    status: 'completed',
    orderTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    preparationStartTime: new Date(Date.now() - (2 * 60 - 5) * 60 * 1000),
    preparationEndTime: new Date(Date.now() - (2 * 60 - 22) * 60 * 1000),
    pickedWeight: 1.02,
    revenue: 480,
  },
  {
    id: 'ORD-006',
    customerName: 'Emily Davis',
    items: [
      { id: 'k1i2', name: 'Ayala - Mackerel', quantity: 2, unit: 'kg', size: 'big', cutType: 'Whole fish' },
    ],
    status: 'rejected',
    orderTime: new Date(Date.now() - 3 * 60 * 60 * 1000),
    rejectionReason: 'Out of stock',
  },
  {
    id: 'ORD-007',
    customerName: 'Michael Miller',
    items: [
      { id: 'c1i1', name: 'Chicken Meat', quantity: 3, unit: 'kg', cutType: 'Biryani cut' },
    ],
    status: 'completed',
    orderTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
    preparationStartTime: new Date(Date.now() - (4 * 60 - 10) * 60 * 1000),
    preparationEndTime: new Date(Date.now() - (4 * 60 - 25) * 60 * 1000),
    pickedWeight: 2.98,
    revenue: 894,
  },
];
