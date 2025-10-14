# Railway Google Sheets Authentication Fix

## Problem
You're getting this error on Railway deployment:
```
Error: invalid_grant: Invalid grant: account not found
```

## Root Cause
The Google Sheets service account authentication is failing because:
1. Environment variables are not properly set on Railway
2. The private key format is incorrect
3. The service account doesn't have access to the Google Sheets

## Solution Steps

### 1. Fix Environment Variables on Railway

Go to your Railway project dashboard and set these environment variables:

#### Required Environment Variables:
```
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
BUTCHER_POS_SHEET_ID=your-butcher-pos-sheet-id
MENU_POS_SHEET_ID=your-menu-pos-sheet-id
SALES_VCS_SPREADSHEET_ID=your-sales-vcs-sheet-id
```

#### Important Notes for Railway:
- **Remove quotes** from the client email: `your-service-account@project.iam.gserviceaccount.com` (not `"your-service-account@project.iam.gserviceaccount.com"`)
- **Keep quotes** around the private key: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- **Use actual newlines** in the private key (not `\n` literals)

### 2. Get Your Google Service Account Credentials

#### Step 1: Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if you don't have one)

#### Step 2: Enable Google Sheets API
1. Go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

#### Step 3: Create Service Account
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - Name: `butcher-pos-service`
   - Description: `Service account for Butcher POS system`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

#### Step 4: Generate Key
1. Find your service account in the list
2. Click on it
3. Go to "Keys" tab
4. Click "Add Key" > "Create new key"
5. Choose "JSON" format
6. Download the JSON file

#### Step 5: Extract Credentials
From the downloaded JSON file, extract:
- `client_email` → Use as `GOOGLE_SHEETS_CLIENT_EMAIL`
- `private_key` → Use as `GOOGLE_SHEETS_PRIVATE_KEY`

### 3. Share Google Sheets with Service Account

#### For each Google Sheet:
1. Open your Google Sheet
2. Click "Share" button
3. Add the service account email (from step 5 above)
4. Give it "Editor" permissions
5. Click "Send"

#### Required Sheets:
- Butcher POS Sheet (for orders)
- Menu POS Sheet (for menu items)
- Sales VCS Sheet (for D.A.M analysis)

### 4. Get Sheet IDs

From your Google Sheets URLs, extract the Sheet IDs:
- URL format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
- Example: `https://docs.google.com/spreadsheets/d/1QYABLczgHKIXC_shTG_xrBXiLWuqziRjkaujLhg9Sl4/edit`
- Sheet ID: `1QYABLczgHKIXC_shTG_xrBXiLWuqziRjkaujLhg9Sl4`

### 5. Set Environment Variables on Railway

#### Method 1: Railway Dashboard
1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add each environment variable:
   ```
   GOOGLE_SHEETS_CLIENT_EMAIL = your-service-account@project.iam.gserviceaccount.com
   GOOGLE_SHEETS_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
   BUTCHER_POS_SHEET_ID = your-butcher-pos-sheet-id
   MENU_POS_SHEET_ID = your-menu-pos-sheet-id
   SALES_VCS_SPREADSHEET_ID = your-sales-vcs-sheet-id
   ```

#### Method 2: Railway CLI
```bash
railway variables set GOOGLE_SHEETS_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
railway variables set GOOGLE_SHEETS_PRIVATE_KEY='"-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"'
railway variables set BUTCHER_POS_SHEET_ID="your-butcher-pos-sheet-id"
railway variables set MENU_POS_SHEET_ID="your-menu-pos-sheet-id"
railway variables set SALES_VCS_SPREADSHEET_ID="your-sales-vcs-sheet-id"
```

### 6. Deploy and Test

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Fix Google Sheets authentication"
   git push
   ```

2. Railway will automatically redeploy

3. Check the logs for successful authentication:
   ```
   Google Sheets client created successfully
   ```

### 7. Troubleshooting

#### If you still get authentication errors:

1. **Check the logs** for detailed error messages
2. **Verify environment variables** are set correctly on Railway
3. **Ensure service account** has access to all required sheets
4. **Check private key format** - it should include the full key with proper line breaks

#### Common Issues:

1. **Missing quotes around private key**: The private key must be wrapped in quotes
2. **Wrong sheet permissions**: Service account must have Editor access
3. **Incorrect sheet IDs**: Double-check the sheet IDs from the URLs
4. **Service account not activated**: Make sure the service account is active in Google Cloud Console

### 8. Test the Fix

After deployment, test these endpoints:
- `/api/health` - Should return success
- `/api/orders/[butcherId]` - Should fetch orders without errors
- `/api/dam-analysis/target` - Should work for D.A.M analysis

## Code Changes Made

The following improvements were made to handle authentication better:

1. **Enhanced error handling** in `src/lib/sheets.ts`
2. **Better private key formatting** to handle different formats
3. **Detailed logging** to help debug authentication issues
4. **Consistent authentication** across all Google Sheets operations

## Support

If you continue to have issues:
1. Check Railway logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure the service account has proper permissions
4. Test the Google Sheets API access manually using the service account credentials
