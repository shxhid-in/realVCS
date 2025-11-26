# Environment Variables Setup

## Required Environment Variables

Add these to your `.env` file or environment configuration:

```env
# Central API Configuration
CENTRAL_API_BASE_URL=http://localhost:3005
# In production, use: https://your-central-api-domain.com

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
API_SECRET=your-super-secret-jwt-key-change-this-in-production

# Google Sheets Configuration (existing)
BUTCHER_POS_SHEET_ID=your-sheet-id
MENU_POS_SHEET_ID=your-menu-sheet-id
GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account-email
GOOGLE_SHEETS_PRIVATE_KEY=your-private-key

# Butcher-specific Service Accounts (existing)
BUTCHER_USAJ_CLIENT_EMAIL=...
BUTCHER_USAJ_PRIVATE_KEY=...
BUTCHER_PKD_CLIENT_EMAIL=...
BUTCHER_PKD_PRIVATE_KEY=...
# ... (other butchers)
```

## Important Notes

1. **JWT_SECRET and API_SECRET**: Use the same value or different values - both should be strong, random strings in production
2. **CENTRAL_API_BASE_URL**: Update this to your actual Central API URL
3. **Security**: Never commit `.env` file to version control

