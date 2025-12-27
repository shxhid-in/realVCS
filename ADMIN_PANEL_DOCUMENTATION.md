# Admin Panel - Complete Tab List & Functionalities

## Overview
The Admin Panel is a comprehensive dashboard for monitoring and managing all aspects of the VCS (Virtual Butcher System) platform. It provides real-time analytics, order management, and OPS-focused tools.

**Last Updated:** Restructured to focus on essential OPS functionality

---

## Main Tabs (5 Total - Streamlined)

### 1. **Overview** 📊
**Icon:** BarChart3  
**Purpose:** High-level dashboard with key metrics and visualizations

#### Functionalities:
- **Time Frame Selection**
  - Filter by: Daily, Weekly, Monthly, or Custom date range
  - Butcher filter: All butchers or individual butcher selection
  - Manual refresh button to reload orders from Google Sheets

- **Key Metrics Cards:**
  - **Total Revenue:** Shows revenue for selected time frame and butcher(s)
  - **Total Orders:** Displays total orders with breakdown (completed, declined)
  - **Completion Rate:** Percentage of successfully completed orders
  - **Average Prep Time:** Average preparation time in minutes

- **Charts:**
  - **Revenue by Butcher:** Bar chart showing revenue distribution across all butchers
  - **Revenue Trend:** Area chart showing revenue trends over time

- **Item Statistics:**
  - Today's item-wise statistics (weight, revenue, count)
  - Sorted by revenue (highest first)

---

### 2. **Butchers** 👥
**Icon:** Users  
**Purpose:** Individual butcher performance analysis

#### Functionalities:
- **Butcher Performance Table:**
  - Butcher name
  - Total orders count
  - Completed orders count
  - Completion rate (with color-coded badges: Green ≥80%, Yellow ≥60%, Red <60%)
  - Total revenue per butcher

- **Features:**
  - Manual refresh to update data from sheets
  - Responsive table with horizontal scroll on mobile
  - Loading skeletons during data fetch

---

### 3. **Analytics** 📈
**Icon:** TrendingUp  
**Component:** `OrdersAnalytics`

#### Functionalities:
- **Order Filtering:**
  - Butcher selection (All or specific butcher)
  - Date range: Daily, Weekly, Monthly, Custom
  - Custom date range picker

- **Order Management:**
  - Complete order list with detailed information
  - Order status badges (New, Preparing, Prepared, Completed, Rejected, etc.)
  - Order details: ID, customer name, items, weight, revenue, address
  - Color-coded order rows based on status

- **Summary Statistics:**
  - Total orders
  - Completed orders
  - Rejected/Declined orders
  - Preparing orders
  - New orders
  - Total revenue

- **Item Statistics:**
  - Item-wise breakdown (weight, revenue, count)
  - Purchase price calculation from menu sheets
  - Revenue calculation based on actual purchase prices

- **Export Functionality:**
  - Export orders to CSV
  - Includes: Order ID, Butcher, Customer, Items, Status, Order Time, Prep Time, Weight, Revenue, Address

- **Features:**
  - Manual refresh button
  - Loading states
  - Deduplication of orders
  - Real-time revenue calculation

---

### 4. **D.A.M Analysis** 🎯
**Icon:** Target  
**Component:** `DAMAnalysis`  
**Sub-tabs:** 6 internal tabs

#### Main Functionalities:
- **Monthly Target Management:**
  - Set monthly revenue targets
  - View current progress vs target
  - Progress percentage calculation
  - Visual progress indicators

#### Sub-tabs:

##### 4.1. **Targets** 🎯
- Set and save monthly revenue targets
- Display current month's target
- Show progress percentage
- Visual progress bar
- Refresh button

##### 4.2. **Weekly Progress** 📅
- Weekly breakdown of progress
- Week-by-week revenue tracking
- Comparison with monthly target
- Progress visualization

##### 4.3. **Butcher Analysis** 👥
- Individual butcher performance against targets
- Butcher-wise revenue breakdown
- Contribution percentage per butcher
- Performance metrics

##### 4.4. **Margin Analysis** 💰
- Revenue margin calculations
- Profit analysis
- Cost vs revenue breakdown
- Margin percentage per category/butcher

##### 4.5. **Performance Insights** 💡
- Key insights and trends
- Performance indicators
- Revenue patterns
- Actionable recommendations

##### 4.6. **Recommendations** 📊
- AI/Algorithm-based recommendations
- Optimization suggestions
- Performance improvement tips
- Strategic insights

---

### 5. **Support** 💬
**Icon:** MessageSquare  
**Purpose:** Manage butcher support requests and packing orders

#### Functionalities:
- **Support Request Management:**
  - View all support requests from butchers
  - Filter by status (Pending, Responded, Resolved)
  - Auto-refresh every 30 seconds (toggleable)
  - Manual refresh button
  - Last update timestamp display

- **Request Types:**
  - **Packing Request:** Requests for packing materials/sizes
    - Selected packing sizes displayed
    - Visual indicators for selected sizes
  - **General Contact:** General support messages

- **Request Details:**
  - Butcher name
  - Request timestamp
  - Status badge
  - Message content
  - Packing request details (if applicable)
  - Admin response (if responded)

- **Actions:**
  - **Respond:** Open modal to type admin response
  - **Mark Resolved:** Quick action to mark as resolved
  - **Delete:** Remove support request (with confirmation dialog)

- **Response Modal:**
  - Text area for admin response
  - Send response button
  - Cancel button
  - Status update on send

- **Features:**
  - Color-coded cards (orange for pending, green for resolved)
  - Confirmation dialog for delete action
  - Real-time updates
  - Auto-polling enabled by default

---

## Removed Tabs (No Longer Available)

### Rate Monitor
- **Status:** Removed
- **Reason:** Not essential for OPS operations
- **Note:** System monitoring can be handled at infrastructure level

### Notifications
- **Status:** Removed
- **Reason:** Not critical for daily OPS workflow
- **Note:** Order decline information can be viewed in Orders/Analytics tab

### Settings (Commission & Markup Rates)
- **Status:** Removed
- **Reason:** Revenue calculation uses static config from `butcherConfig.ts`, not Google Sheets
- **Note:** Commission and markup rates are configured in code, not through admin panel

---

## Additional Features

### Global Features:
- **Theme Toggle:** Light/Dark mode switcher
- **Logout Button:** Admin logout functionality
- **Responsive Design:** Mobile-friendly with horizontal scrolling tabs
- **Loading States:** Skeleton loaders and loading indicators
- **Error Handling:** Error messages and retry options
- **Toast Notifications:** Success/error feedback
- **Auto-refresh:** Polling for support requests and notifications (30s interval)
- **Rate Limiting:** Built-in rate limiting for Google Sheets API calls (600ms delay between requests)

### Data Sources:
- **Google Sheets Integration:**
  - ButcherPOS sheet (orders)
  - Menu sheet (prices, availability)
  - Rates sheet (commission/markup rates)
  - Contact sheet (support requests)
  - Notifications sheet (system notifications)
  - Targets sheet (DAM analysis targets)

### Authentication:
- Admin-only access with redirect for non-admins
- JWT token-based authentication
- Session management

---

## Technical Stack
- **Framework:** Next.js (React)
- **UI Components:** Custom UI components (shadcn/ui style)
- **Charts:** Recharts library
- **Date Handling:** date-fns
- **State Management:** React hooks (useState, useEffect, useCallback)
- **API:** RESTful API endpoints
- **Data Storage:** Google Sheets (via API)

---

## Summary

The Admin Panel consists of **5 main tabs** (streamlined from 8):

1. **Overview** - Dashboard with metrics and charts
2. **Butchers** - Individual butcher performance
3. **Analytics** - Detailed order analytics and export
4. **D.A.M Analysis** - Target tracking with 6 sub-tabs
5. **Support** - Support request management

### Removed Tabs:
- **Rate Monitor** - Removed (not essential for OPS)
- **Notifications** - Removed (not critical for workflow)
- **Settings** - Removed (rates configured in code)

### Future Enhancements:
- **Zoho Integration** - Invoice and payment tracking
- **Enhanced Orders View** - OPS-focused order management
- **Financial Dashboard** - Payment and revenue insights

See `ADMIN_PANEL_RESTRUCTURING_PLAN.md` for detailed implementation plan.

