# Sales Data Upload Fix Guide

## Problem
When an order is completed, the data is not getting uploaded to the Sales VCS sheet for D.A.M analysis.

## Root Cause Analysis
The sales data upload is triggered in the `handlePrepared` function when an order is marked as "prepared", but the order status is immediately changed to "completed" in the same function. The upload should happen for completed orders.

## Solutions Implemented

### 1. Enhanced Error Handling
- ✅ **Better error logging** in `saveSalesDataToSheet` function
- ✅ **Environment variable validation** with detailed error messages
- ✅ **Error propagation** to ensure failures are not silent
- ✅ **User notifications** for upload failures

### 2. Improved Upload Logic
- ✅ **Status-based upload** - Only upload for completed orders
- ✅ **Better logging** to track upload process
- ✅ **User feedback** for upload success/failure

### 3. Test Endpoint
- ✅ **Created `/api/test-sales-upload`** for debugging
- ✅ **Environment variable check** endpoint
- ✅ **Manual upload testing** capability

## Debugging Steps

### Step 1: Check Environment Variables
Make sure these environment variables are set on Railway:

```bash
# Required for Google Sheets authentication
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"

# Required for Sales VCS sheet access
SALES_VCS_SPREADSHEET_ID=your-sales-vcs-sheet-id
```

### Step 2: Test Environment Variables
Call the test endpoint to check if environment variables are properly set:

```bash
GET https://your-app.railway.app/api/test-sales-upload
```

This will return:
```json
{
  "success": true,
  "message": "Environment variables check completed",
  "environment": {
    "hasGoogleSheetsClientEmail": true,
    "hasGoogleSheetsPrivateKey": true,
    "hasSalesVcsSpreadsheetId": true,
    "salesVcsSpreadsheetId": "your-sheet-id",
    "googleSheetsClientEmail": "your-service-account@..."
  }
}
```

### Step 3: Test Sales Data Upload
Use the test endpoint to manually test sales data upload:

```bash
POST https://your-app.railway.app/api/test-sales-upload
Content-Type: application/json

{
  "orderId": "ORD-2024-01-15-123",
  "butcherId": "usaj",
  "orderData": {
    "id": "ORD-2024-01-15-123",
    "status": "completed",
    "items": [
      {
        "name": "Chicken Breast",
        "quantity": 2,
        "category": "meat"
      }
    ],
    "itemQuantities": {
      "Chicken Breast": "2.5"
    },
    "revenue": 500,
    "completionTime": "15:30"
  }
}
```

### Step 4: Check Railway Logs
After completing an order, check the Railway logs for:

1. **Sales data upload logs**:
   ```
   === DASHBOARD: Sending sales data for completed order ===
   === SALES DATA API CALLED ===
   === SALES DATA SAVING DEBUG ===
   ✅ Sales data saved for order ORD-2024-01-15-123 in butcher usaj tab
   ```

2. **Error logs** (if any):
   ```
   ❌ Sales VCS Spreadsheet ID not found in environment variables
   ❌ Error appending to Google Sheets: [error details]
   ```

### Step 5: Verify Google Sheets Access
Ensure your service account has access to the Sales VCS sheet:

1. **Open your Sales VCS Google Sheet**
2. **Click "Share" button**
3. **Add your service account email** (from `GOOGLE_SHEETS_CLIENT_EMAIL`)
4. **Give it "Editor" permissions**
5. **Click "Send"**

### Step 6: Check Sheet Structure
Verify your Sales VCS sheet has the correct tabs for each butcher:

- `Usaj_Meat_Hub` (for usaj butcher)
- `Usaj_Mutton_Shop` (for usaj_mutton butcher)
- `PKD_Stall` (for pkd butcher)
- `KAK` (for kak butcher)
- `KA_Sons` (for ka_sons butcher)
- `Alif` (for alif butcher)

Each tab should have headers in row 1:
```
A: Order Date
B: Order ID
C: Items
D: Quantities
E: Cut Types
F: Preparing Weights
G: Completion Time
H: Start Time
I: Status
J: Sales Revenue
```

## Common Issues and Solutions

### Issue 1: "Sales VCS Spreadsheet ID not found"
**Solution**: Set the `SALES_VCS_SPREADSHEET_ID` environment variable on Railway

### Issue 2: "Invalid grant: account not found"
**Solution**: 
- Check Google Sheets authentication credentials
- Ensure service account has access to the Sales VCS sheet
- Verify private key format is correct

### Issue 3: "Tab not found" or "Range not found"
**Solution**:
- Check if the butcher tab exists in the Sales VCS sheet
- Verify tab names match the expected format
- Ensure the service account has Editor access to the sheet

### Issue 4: Sales data upload fails silently
**Solution**:
- Check Railway logs for error messages
- Use the test endpoint to debug
- Verify all environment variables are set correctly

## Testing the Fix

### 1. Complete an Order
1. Go to your dashboard
2. Accept a new order
3. Mark it as "Prepared" (this will change status to "completed")
4. Check Railway logs for sales data upload messages

### 2. Verify Data in Sales VCS Sheet
1. Open your Sales VCS Google Sheet
2. Go to the appropriate butcher's tab
3. Check if the order data appears in the last row
4. Verify all columns are populated correctly

### 3. Check D.A.M Analysis
1. Go to the D.A.M Analysis tab (admin user)
2. Verify that the completed order appears in the analytics
3. Check if revenue and margin calculations are correct

## Code Changes Made

### 1. Enhanced Error Handling (`src/lib/salesSheets.ts`)
- Added detailed error logging
- Improved environment variable validation
- Better error propagation

### 2. Improved Upload Logic (`src/app/dashboard/page.tsx`)
- Added status check for completed orders
- Enhanced user feedback for upload failures
- Better logging for debugging

### 3. Test Endpoint (`src/app/api/test-sales-upload/route.ts`)
- Environment variable validation
- Manual upload testing capability
- Detailed error reporting

## Next Steps

1. **Deploy the changes** to Railway
2. **Set environment variables** if not already set
3. **Test with a real order** completion
4. **Check logs** for any errors
5. **Verify data** appears in Sales VCS sheet
6. **Test D.A.M analysis** functionality

## Support

If you continue to have issues:
1. Check Railway logs for detailed error messages
2. Use the test endpoint to debug environment variables
3. Verify Google Sheets permissions and access
4. Test with a simple order completion
5. Check if the Sales VCS sheet has the correct structure
