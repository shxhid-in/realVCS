# Orders Tab Restructure Plan

## Overview
Restructure the Orders tab to have two sub-tabs: **Invoices** and **Payments**, each with their own functionality and date filtering.

## Current Structure
- Single Orders tab showing invoices with payment status
- Date filter at the top
- Click invoice to open modal for editing
- Payment links fetched per invoice (not working due to API limitations)

## Proposed Structure

### Main Orders Tab
- **Shared Date Filter** at the top (applies to both sub-tabs)
- **Two Sub-tabs:**
  1. **Invoices** tab
  2. **Payments** tab

---

## 1. Invoices Sub-tab

### Features:
- ✅ List invoices for selected date
- ✅ Show invoice status in the list
- ✅ Display: Order number, Customer phone, Items (with weights), Amount, Invoice Status, Payment Status
- ✅ "Create Invoice" button (top right)
- ✅ Click invoice row to open edit modal
- ✅ Remove action buttons from list (actions in modal only)

### Table Columns:
1. **Order Number** - Invoice number (INV-XXXXX)
2. **Customer Phone** - Primary phone from invoice
3. **Items** - Item count with preview (expandable)
4. **Amount** - Total invoice amount
5. **Invoice Status** - Draft, Sent, Paid, Overdue, etc.
6. **Payment Status** - Paid, Unpaid, Pending, COD
7. **Actions** - Click to open modal (no buttons in list)

### Actions in Modal:
- Edit invoice details
- View/edit payment links
- Create payment link
- Mark as paid (for COD)

---

## 2. Payments Sub-tab

### Features:
- ✅ List payments for selected date
- ✅ Show payment link information if available
- ✅ "Create Payment Link" button (top right)
- ✅ Edit payment link option
- ✅ Display payment details

### Table Columns:
1. **Payment ID** - Payment reference number
2. **Date & Time** - Payment timestamp
3. **Customer** - Phone/Email
4. **Amount** - Payment amount
5. **Payment Method** - UPI, Card, Net Banking, etc.
6. **Status** - Succeeded, Failed, Refunded
7. **Invoice** - Linked invoice number (if any)
8. **Payment Link** - Link status (Active, Paid, Expired)
9. **Actions** - Edit payment link, View details

### Actions:
- Create new payment link
- Edit existing payment link
- View payment details
- Resend payment link

---

## Implementation Details

### Component Structure:
```
OrdersTab
├── DateFilter (shared)
├── Tabs (Invoices | Payments)
│   ├── InvoicesTab
│   │   ├── Create Invoice Button
│   │   ├── Invoice List Table
│   │   └── InvoiceModal (on click)
│   └── PaymentsTab
│       ├── Create Payment Link Button
│       ├── Payments List Table
│       └── PaymentLinkModal (on click)
```

### Data Fetching:
- **Invoices Tab:** Fetch invoices by date (existing logic)
- **Payments Tab:** Fetch payments by date (existing logic)
- Both use the same date filter

### State Management:
- `selectedDate` - Shared between both tabs
- `activeSubTab` - 'invoices' | 'payments'
- `invoices` - Invoice data
- `payments` - Payment data
- `selectedInvoice` - For modal
- `selectedPayment` - For modal

### API Endpoints:
- `/api/zoho/invoices?date=YYYY-MM-DD` - Get invoices
- `/api/zoho/payments?date=YYYY-MM-DD` - Get payments
- `/api/zoho/payment-links` - Create/edit payment links
- `/api/zoho/invoices` - Create/edit invoices

---

## UI/UX Considerations

### Date Filter:
- Single date picker at the top
- Applies to both sub-tabs
- Default: Today's date
- Format: YYYY-MM-DD

### Tab Navigation:
- Use shadcn/ui Tabs component
- Clear visual distinction between tabs
- Active tab highlighted

### List Views:
- Clean, scannable table layout
- Expandable rows for details
- Status badges with colors
- Responsive design

### Modals:
- InvoiceModal - For invoice editing (existing)
- PaymentLinkModal - For payment link management (new)

---

## Benefits:
1. ✅ Clear separation of invoices and payments
2. ✅ Better organization for OPS team
3. ✅ Can show payments even without payment links API
4. ✅ Easier to manage payment links separately
5. ✅ Create invoice/payment link directly from respective tabs

---

## Questions to Confirm:
1. Should payment links be shown in Payments tab or only payments?
   - **Proposed:** Show payments, with payment link info if available
2. Can we create invoices from the admin panel?
   - **Proposed:** Yes, add "Create Invoice" button
3. Should we show all payments or only those linked to invoices?
   - **Proposed:** Show all payments for the date
4. What fields should be editable in payment links?
   - **Proposed:** Amount, description, expiry date, customer details

---

## Next Steps:
1. ✅ Get user confirmation on the plan
2. Create InvoicesTab component
3. Create Payments tab component
4. Update OrdersTab to use sub-tabs
5. Add Create Invoice functionality
6. Add Create Payment Link functionality
7. Update modals for editing
8. Test date filtering for both tabs

