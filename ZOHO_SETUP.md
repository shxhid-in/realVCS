# Zoho Integration Setup Guide

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Zoho Books/Invoice Configuration
ZOHO_ORGANIZATION_ID=600#######3
ZOHO_CLIENT_ID=1000.#################KKVKGXH
ZOHO_CLIENT_SECRET=614fc################8d735de6dbe2fb2
ZOHO_REFRESH_TOKEN=1000.b######################.9b9f95a1fadf395c6d0804a1f2136cb1

# Zoho Payments Configuration
ZOHO_PAYMENTS_ACCOUNT_ID=6004#####2
ZOHO_PAYMENTS_CLIENT_ID=1005.9#################H1P4VJXTI
ZOHO_PAYMENTS_CLIENT_SECRET=7a##################################dd359f
ZOHO_PAYMENTS_REFRESH_TOKEN=1005.25a722#############62##########1d9cffdd8c987faecb6

# Data Center (same for both)
ZOHO_DATA_CENTER=com  # Options: com, eu, in, com.au, jp, ca, com.cn, sa

# Optional: Debug Mode (set to 'true' to enable detailed logging, 'false' or remove to disable)
ZOHO_DEBUG=false  # Set to 'true' for troubleshooting, 'false' for production
```

## Important Notes

1. **Separate OAuth Clients**: Zoho Books/Invoice and Zoho Payments use different OAuth clients
2. **Automatic Token Refresh**: The system automatically refreshes access tokens using refresh tokens
3. **Token Caching**: Access tokens are cached and refreshed 5 minutes before expiration
4. **No Manual Token Management**: You don't need to manually refresh tokens - it's handled automatically

## Getting Zoho Credentials

### 1. OAuth2 Credentials (Books/Invoice)

1. Go to [Zoho Developer Console](https://api-console.zoho.com/)
2. Create a new application for **Zoho Books/Invoice**
3. Select OAuth2 Client
4. Add scopes:
   - `ZohoInvoice.fullaccess.all` or `ZohoBooks.fullaccess.all`
5. Generate **Refresh Token** (not access token)
6. Copy:
   - Client ID → `ZOHO_CLIENT_ID`
   - Client Secret → `ZOHO_CLIENT_SECRET`
   - Refresh Token → `ZOHO_REFRESH_TOKEN`

### 2. OAuth2 Credentials (Payments)

1. Go to [Zoho Developer Console](https://api-console.zoho.com/)
2. Create a **separate** application for **Zoho Payments**
3. Select OAuth2 Client
4. Add scopes:
   - `ZohoPayments.fullaccess.all`
5. Generate **Refresh Token**
6. Copy:
   - Client ID → `ZOHO_PAYMENTS_CLIENT_ID`
   - Client Secret → `ZOHO_PAYMENTS_CLIENT_SECRET`
   - Refresh Token → `ZOHO_PAYMENTS_REFRESH_TOKEN`

### 3. Organization ID (Books/Invoice)

1. Login to Zoho Invoice/Books
2. Go to Settings → Organization
3. The Organization ID is visible in the URL or API response
4. Copy to → `ZOHO_ORGANIZATION_ID`

### 4. Account ID (Payments)

1. Login to Zoho Payments
2. Go to Settings → Account
3. Find your Account ID
4. Copy to → `ZOHO_PAYMENTS_ACCOUNT_ID`

### 5. Data Center

Check your Zoho URL:
- `invoice.zoho.com` → `com`
- `invoice.zoho.eu` → `eu`
- `invoice.zoho.in` → `in`
- etc.
- Copy to → `ZOHO_DATA_CENTER`

## API Documentation

- [Zoho Invoice API v3](https://www.zoho.com/invoice/api/v3/introduction/#overview)
- [Zoho Payments API v1](https://www.zoho.com/in/payments/api/v1/introduction/#account-id)

## Order Number Matching Logic

The system matches invoices with payments using order numbers:

- **Invoice Format:** `DDMMNNN` (Day, Month, Order Number)
- **Payment Description Format:** `DDMMYYNNN` (Day, Month, Year, Order Number)
- **Matching:** Extracts `NNN` (order number) from both and matches

Example:
- Invoice: `1507123` → Order Number: `123`
- Payment Description: `150724123` → Order Number: `123`
- ✅ Match!

## How Token Refresh Works

The system automatically handles token refresh:

1. **On First API Call**: Refresh token is used to get access token
2. **Token Caching**: Access token is cached in memory
3. **Auto-Refresh**: Token is refreshed 5 minutes before expiration
4. **Transparent**: You don't need to do anything - it's automatic!

## Debug Mode

To enable detailed logging for troubleshooting:

1. Set `ZOHO_DEBUG=true` in your `.env.local` file
2. Restart your development server
3. Check console logs for detailed API request/response information
4. **Important**: Set `ZOHO_DEBUG=false` or remove it after troubleshooting to keep console clean

## Testing the Integration

1. Set up all environment variables
2. Restart the development server
3. Test API endpoints:
   - `GET /api/zoho/invoices?date=2024-01-15`
   - `GET /api/zoho/payments?all=true`
   - `GET /api/zoho/payment-links?invoice_id=xxx`

4. Check the Orders tab in Admin Panel
5. Verify order matching works correctly

## Troubleshooting

### Error: "Zoho Books credentials not configured"
- Check `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, and `ZOHO_REFRESH_TOKEN` are set
- Restart the development server after adding env vars

### Error: "Zoho Payments credentials not configured"
- Check `ZOHO_PAYMENTS_CLIENT_ID`, `ZOHO_PAYMENTS_CLIENT_SECRET`, and `ZOHO_PAYMENTS_REFRESH_TOKEN` are set
- Restart the development server after adding env vars

### Error: "Invalid refresh token"
- Refresh token may be incorrect or expired
- Generate a new refresh token from Zoho Developer Console
- Make sure you're using the correct refresh token for each service (Books vs Payments)

### Error: "Token refresh failed"
- Check your Client ID and Client Secret are correct
- Verify the data center matches your Zoho account
- Check network connectivity to Zoho OAuth servers

### Error: "Organization ID not found"
- Verify the organization ID is correct
- Check data center matches your Zoho account

### Orders not matching with payments
- Verify order number format matches expected pattern
- Check payment descriptions contain order numbers
- Review matching logic in `zohoService.ts`

