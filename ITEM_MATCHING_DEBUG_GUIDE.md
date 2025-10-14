# Item Matching Debug Guide

## Problem
Sales data upload only works for "Chicken Nadan" items, but fails for other items. This suggests an issue with item name matching in the menu lookup.

## Root Cause Analysis
The issue is likely in the `getSellingPriceFromMenu` function, which is responsible for finding the selling price of items from the Menu POS sheet. If this function returns 0 for most items, the sales revenue calculation will be 0, causing incomplete or failed uploads.

## Debugging Steps

### Step 1: Test Item Matching
Use the new test endpoint to check if specific items can be found in the menu:

```bash
GET https://your-app.railway.app/api/test-item-matching?butcherId=usaj&itemName=Chicken Nadan
```

This will return:
```json
{
  "success": true,
  "message": "Item matching test completed",
  "data": {
    "butcherId": "usaj",
    "itemName": "Chicken Nadan",
    "sellingPrice": 250,
    "found": true
  }
}
```

### Step 2: Test Different Items
Test with items that are failing:

```bash
GET https://your-app.railway.app/api/test-item-matching?butcherId=usaj&itemName=Chicken Breast
GET https://your-app.railway.app/api/test-item-matching?butcherId=usaj&itemName=Beef
GET https://your-app.railway.app/api/test-item-matching?butcherId=kak&itemName=Salmon
```

### Step 3: Check Railway Logs
After completing an order, check the Railway logs for detailed item matching information:

1. **Look for item processing logs**:
   ```
   Processing item: Chicken Breast, preparing weight: 2.5
   Looking up selling price for item: Chicken Breast (lookup: Chicken Breast) in butcher: usaj
   ```

2. **Look for menu lookup logs**:
   ```
   Getting menu data from butcher tab: Usaj_Meat_Hub (original: usaj)
   Found 25 rows in menu sheet for butcher usaj
   Searching for item "Chicken Breast" in 24 menu items...
   ```

3. **Look for matching results**:
   ```
   ✅ Found selling price for Chicken Breast: 300 (matched with: Chicken Breast)
   ```
   OR
   ```
   ⚠️ WARNING: No selling price found for item "Chicken Breast" in butcher "usaj"
   ```

### Step 4: Check Menu Sheet Structure
Verify your Menu POS sheet has the correct structure:

#### For Meat Butchers (usaj, usaj_mutton, pkd):
- **Tab names**: `Usaj_Meat_Hub`, `Usaj_Mutton_Shop`, `PKD_Stall`
- **Columns**: A (Item Name), B (Size), C (Price), D (Selling Price)
- **Selling price column**: D (index 3)

#### For Fish Butchers (kak, ka_sons, alif):
- **Tab names**: `KAK`, `KA_Sons`, `Alif`
- **Columns**: A (Item Name), B (Size), C (Price), D (Purchase Price), E (Selling Price)
- **Selling price column**: E (index 4)

### Step 5: Check Item Names
The most common issue is item name mismatches. Check:

1. **Exact spelling**: "Chicken Breast" vs "Chicken breast" vs "chicken breast"
2. **Extra spaces**: "Chicken Breast " vs "Chicken Breast"
3. **Special characters**: "Chicken-Breast" vs "Chicken Breast"
4. **Different naming**: "Chicken Breast" vs "Chicken Breast (Boneless)"

## Common Issues and Solutions

### Issue 1: Item Name Mismatch
**Symptoms**: 
- Item not found in menu lookup
- Selling price returns 0
- Warning messages in logs

**Solutions**:
1. **Check exact item names** in your Menu POS sheet
2. **Use consistent naming** between order items and menu items
3. **Check for extra spaces** or special characters
4. **Update menu items** to match order item names

### Issue 2: Wrong Butcher Tab
**Symptoms**:
- Menu lookup fails for all items
- "No rows found" or "Tab not found" errors

**Solutions**:
1. **Verify tab names** in Menu POS sheet match expected names
2. **Check butcher ID mapping** in the code
3. **Ensure service account** has access to Menu POS sheet

### Issue 3: Wrong Column Structure
**Symptoms**:
- Menu data found but selling price is 0
- "Insufficient columns" warnings

**Solutions**:
1. **Check column structure** in Menu POS sheet
2. **Verify selling price column** has data
3. **Ensure correct column mapping** for meat vs fish butchers

### Issue 4: Environment Variables
**Symptoms**:
- "Menu POS Spreadsheet ID not found" errors
- Menu lookup fails completely

**Solutions**:
1. **Set MENU_POS_SHEET_ID** environment variable on Railway
2. **Verify spreadsheet ID** is correct
3. **Check service account** has access to Menu POS sheet

## Testing the Fix

### 1. Test Individual Items
Use the test endpoint to verify each item can be found:

```bash
# Test successful item
GET /api/test-item-matching?butcherId=usaj&itemName=Chicken Nadan

# Test failing item
GET /api/test-item-matching?butcherId=usaj&itemName=Chicken Breast
```

### 2. Complete Test Orders
1. **Create orders** with different items
2. **Complete the orders** in your dashboard
3. **Check Railway logs** for detailed item matching information
4. **Verify data** appears in Sales VCS sheet

### 3. Check Sales VCS Sheet
1. **Open Sales VCS sheet**
2. **Go to appropriate butcher tab**
3. **Check if all items** from completed orders appear
4. **Verify sales revenue** is calculated correctly

## Code Changes Made

### 1. Enhanced Debugging (`src/lib/salesSheets.ts`)
- ✅ **Better item matching logs** in `getSellingPriceFromMenu`
- ✅ **Warning messages** for items with 0 selling price
- ✅ **Total revenue validation** to catch 0 revenue issues
- ✅ **Available menu items listing** for debugging

### 2. Test Endpoint (`src/app/api/test-item-matching/route.ts`)
- ✅ **Individual item testing** capability
- ✅ **Selling price lookup testing**
- ✅ **Detailed error reporting**

## Next Steps

1. **Deploy the changes** to Railway
2. **Test item matching** using the test endpoint
3. **Check Railway logs** for detailed debugging information
4. **Fix any item name mismatches** in your Menu POS sheet
5. **Test with real orders** to verify the fix

## Quick Fix Commands

### Test a specific item:
```bash
curl "https://your-app.railway.app/api/test-item-matching?butcherId=usaj&itemName=Chicken%20Breast"
```

### Test environment variables:
```bash
curl "https://your-app.railway.app/api/test-sales-upload"
```

### Check Railway logs:
```bash
railway logs --follow
```

The enhanced debugging should now show you exactly why certain items are not being found in the menu, allowing you to fix the item name mismatches or other issues.
