# Admin Panel Data Flow Documentation

## Overview
This document explains how data fetching works in the admin panel, which Google Sheets are used, API call patterns, and how data is segregated.

---

## 1. **Google Sheets Used**

### Primary Sheet: **Butcher POS Sheet**
- **Sheet ID**: `BUTCHER_POS_SHEET_ID` (from environment variable)
- **Default ID**: `1QYABLczgHKIXC_shTG_xrBXiLWuqziRjkaujLhg9Sl4`
- **Purpose**: Stores all order data for all butchers
- **Structure**: Each butcher has their own tab within this sheet

### Sheet Tabs (One per Butcher):
- `Usaj_Meat_Hub` - for 'usaj'
- `PKD_Stall` - for 'pkd'
- `Alif` - for 'alif'
- `KAK` - for 'kak'
- `KA_Sons` - for 'ka_sons'
- `Usaj_Mutton_Shop` - for 'usaj_mutton'
- `Test_Meat_Butcher` - for 'test_meat'
- `Test_Fish_Butcher` - for 'test_fish'

### Sheet Columns (Order of data):
1. **Order Date** (Column A)
2. **Order No** (Column B)
3. **Items** (Column C) - comma-separated item names
4. **Quantity** (Column D) - comma-separated quantities
5. **Size** (Column E) - comma-separated sizes
6. **Cut type** (Column F) - comma-separated cut types
7. **Preparing weight** (Column G) - Format: `"item: weight, item: weight"` (e.g., `"chicken meat: 0.75kg, chicken parts: 0.25kg"`)
8. **Completion Time** (Column H) - in minutes
9. **Start time** (Column I) - timestamp
10. **Status** (Column J) - order status
11. **Revenue** (Column K) - Format: `"item: revenue, item: revenue"` (e.g., `"chicken meat: 162.00, chicken parts: 22.50"`)

---

## 2. **API Endpoint Used**

### Endpoint: `/api/analytics/[butcherId]`
- **File**: `src/app/api/analytics/[butcherId]/route.ts`
- **Method**: `GET`
- **Authentication**: Required (JWT token in Authorization header)
- **Authorization**: Only admin users can access all butchers' data
- **Pagination**: Yes (100 orders per page)

### Query Parameters:
- `page` (optional): Page number (default: 1)
- Example: `/api/analytics/usaj?page=1`

### Response Format:
```json
{
  "orders": [/* array of Order objects */],
  "pagination": {
    "page": 1,
    "pageSize": 100,
    "totalCount": 250,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

## 3. **How Many Times API is Called**

### Initial Load:
When the admin panel loads or refresh button is clicked:

1. **For Each Butcher** (typically 8 butchers):
   - Makes API call: `/api/analytics/{butcherId}?page=1`
   - If more than 100 orders exist, makes additional calls:
     - Page 2: `/api/analytics/{butcherId}?page=2`
     - Page 3: `/api/analytics/{butcherId}?page=3`
     - ... and so on until all pages are fetched

2. **Rate Limiting**:
   - **Delay between requests**: 600ms (to stay under Google Sheets API limit of 100 requests/minute)
   - **Total time**: If 8 butchers × 3 pages each = 24 API calls × 600ms = ~14.4 seconds minimum

### Example Calculation:
- **8 butchers** × **3 pages each** = **24 API calls**
- With 600ms delay: **24 × 600ms = 14.4 seconds** (minimum)
- Plus actual API response time (~500ms each): **24 × 1100ms = 26.4 seconds** (realistic)

---

## 4. **How API Calling is Handled**

### Client-Side (Admin Page):
**File**: `src/app/admin/page.tsx`

```typescript
const fetchAllOrders = useCallback(async () => {
  // 1. Get all butcher IDs
  const butcherIds = freshButchers.map(b => b.id);
  
  // 2. For each butcher, fetch all pages sequentially
  for (let i = 0; i < butcherIds.length; i++) {
    const butcherId = butcherIds[i];
    let page = 1;
    let hasMore = true;
    
    // 3. Fetch all pages with rate limiting
    while (hasMore) {
      // Add delay between requests (600ms)
      if (page > 1 || i > 0) {
        await delay(600);
      }
      
      // 4. Make API call
      const response = await fetch(`/api/analytics/${butcherId}?page=${page}`);
      const data = await response.json();
      
      // 5. Process and store orders
      allOrdersData.push(...orders);
      
      // 6. Check if more pages exist
      hasMore = data.pagination?.hasMore || false;
      page++;
    }
  }
}, []);
```

### Server-Side (API Route):
**File**: `src/app/api/analytics/[butcherId]/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. Verify authentication
  const token = authHeader.replace('Bearer ', '');
  const decoded = verifyUserToken(token);
  
  // 2. Check authorization (admin or same butcher)
  if (decoded.role !== 'admin' && decoded.butcherId !== butcherId) {
    return 403 Forbidden;
  }
  
  // 3. Fetch all orders from Google Sheet
  const allOrders = await getOrdersFromSheet(butcherId);
  
  // 4. Paginate results (100 per page)
  const paginatedOrders = allOrders.slice(startIndex, endIndex);
  
  // 5. Return paginated response
  return NextResponse.json({
    orders: paginatedOrders,
    pagination: { ... }
  });
}
```

### Sheet Access Layer:
**File**: `src/lib/sheets.ts`

```typescript
export const getOrdersFromSheet = async (butcherId: string): Promise<Order[]> => {
  // 1. Get Google Sheets client
  const sheets = await getButcherSheetsClient(butcherId);
  
  // 2. Get butcher's tab name
  const tabName = getButcherConfig(butcherId)?.orderSheetTab;
  
  // 3. Read data from sheet (range: A2:K - all rows from row 2 onwards)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: BUTCHER_POS_SHEET_ID,
    range: `${tabName}!A2:K`
  });
  
  // 4. Parse rows into Order objects
  // - Parse preparing weight: "item: weight" format
  // - Parse revenue: "item: revenue" format
  // - Map to Order interface
  
  // 5. Return array of Order objects
  return orders;
}
```

---

## 5. **How Data is Segregated**

### A. By Butcher (Primary Segregation):
- Each butcher has their own tab in the Butcher POS Sheet
- Orders are fetched per butcher using `butcherId`
- Each order object includes `butcherId` and `butcherName` properties

### B. By Date Range (Client-Side Filtering):
After fetching all orders, the client filters by:
- **Daily**: Today's orders
- **Weekly**: This week's orders
- **Monthly**: This month's orders
- **Custom**: User-selected date range

**File**: `src/components/admin/OrdersAnalytics.tsx`

```typescript
const filterOrders = useCallback(() => {
  let filtered = allOrders;
  
  // Filter by butcher
  if (selectedButcher !== 'all') {
    filtered = filtered.filter(order => order.butcherId === selectedButcher);
  }
  
  // Filter by date range
  filtered = filtered.filter(order => {
    const orderDate = new Date(order.orderTime);
    return orderDate >= startDate && orderDate <= endDate;
  });
  
  // Remove duplicates by order ID
  const deduplicatedOrders = removeDuplicateOrders(filtered);
  
  setFilteredOrders(deduplicatedOrders);
}, [allOrders, selectedButcher, dateRange]);
```

### C. Duplicate Removal:
- Orders are deduplicated by `order.id` (keeps first occurrence)
- Prevents showing the same order multiple times

### D. Item-Level Data Segregation:
Each order contains:
- **Items**: Array of `OrderItem` objects
- **Item Weights**: `itemWeights` object mapping item names to preparing weights
  - Format: `{ "chicken meat": "0.75kg", "chicken parts": "0.25kg" }`
- **Item Revenues**: `itemRevenues` object mapping item names to revenues
  - Format: `{ "chicken meat": 162.00, "chicken parts": 22.50 }`

### E. Data Parsing from Sheet:
**Preparing Weight Column** (Column G):
- Format: `"item: weight, item: weight"`
- Example: `"chicken meat: 0.75kg, chicken parts: 0.25kg"`
- Parsed into: `order.itemWeights` or `order.itemQuantities` (depending on butcher type)

**Revenue Column** (Column K):
- Format: `"item: revenue, item: revenue"`
- Example: `"chicken meat: 162.00, chicken parts: 22.50"`
- Parsed into: `order.itemRevenues` object

---

## 6. **Data Flow Summary**

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN PANEL LOAD                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  fetchAllOrders() - Client Side (admin/page.tsx)            │
│  - Loops through all butchers (8 butchers)                  │
│  - For each butcher, fetches all pages                       │
│  - Adds 600ms delay between requests                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  API Call: GET /api/analytics/[butcherId]?page=N            │
│  - Verifies JWT token                                        │
│  - Checks admin authorization                                │
│  - Calls getOrdersFromSheet(butcherId)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  getOrdersFromSheet() - sheets.ts                           │
│  - Gets Google Sheets client                                 │
│  - Reads from butcher's tab (e.g., "Usaj_Meat_Hub")          │
│  - Range: A2:K (all rows, columns A-K)                       │
│  - Parses preparing weight: "item: weight" format            │
│  - Parses revenue: "item: revenue" format                   │
│  - Returns Order[] array                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Client Receives Paginated Response                          │
│  - Combines all pages for each butcher                       │
│  - Combines all butchers into allOrders array                │
│  - Stores in state: setAllOrders(allOrdersData)              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OrdersAnalytics Component                                   │
│  - Receives allOrders as prop                                │
│  - Filters by butcher (if selected)                          │
│  - Filters by date range                                     │
│  - Removes duplicates                                        │
│  - Displays in table with item-wise data                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. **Key Points**

1. **Single Source of Truth**: Butcher POS Sheet (one sheet, multiple tabs)
2. **Rate Limiting**: 600ms delay between API calls to avoid Google Sheets quota
3. **Pagination**: 100 orders per page to handle large datasets
4. **Client-Side Filtering**: All filtering happens after data is fetched
5. **Item-Level Granularity**: Preparing weights and revenues are stored per item
6. **Duplicate Prevention**: Orders deduplicated by order ID
7. **Authentication**: JWT token required, admin role for cross-butcher access

---

## 8. **Performance Considerations**

- **Initial Load Time**: ~15-30 seconds (depending on number of orders)
- **API Calls**: 8-24+ calls (8 butchers × 1-3+ pages each)
- **Rate Limiting**: Prevents hitting Google Sheets API quota (100 req/min)
- **Caching**: Currently no caching - fetches fresh data each time
- **Optimization Opportunity**: Could cache data for 5 minutes to reduce API calls

---

## 9. **Error Handling**

- **Quota Exceeded**: Shows error toast, stops fetching, returns partial data
- **Authentication Failure**: Returns 401 Unauthorized
- **Authorization Failure**: Returns 403 Forbidden
- **Sheet Read Errors**: Logged and returned as 500 error
- **Network Errors**: Caught and displayed to user

---

This flow ensures that the admin panel has access to all order data across all butchers, with proper authentication, rate limiting, and data segregation.



