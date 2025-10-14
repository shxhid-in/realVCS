# 📖 Butcher POS System - User Manual

## 🎯 Table of Contents
1. [Getting Started](#getting-started)
2. [Login & Authentication](#login--authentication)
3. [Order Management](#order-management)
4. [Menu Management](#menu-management)
5. [Analytics Dashboard](#analytics-dashboard)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- Access to Google Sheets (for admin setup)

### First Time Setup
1. **Access the System**: Navigate to your POS system URL
2. **Login**: Use your assigned butcher credentials
3. **Familiarize**: Explore the three main tabs (Order Management, Menu Management, Analytics)

---

## 🔐 Login & Authentication

### Available Butcher Accounts

#### Meat Hubs
- **Usaj**: Specializes in chicken, mutton, beef
- **PKD Stall**: Specializes in chicken, mutton

#### Fish Hubs  
- **KAK**: Sea water fish, fresh water fish, meat items
- **KA Sons**: Sea water fish, fresh water fish, meat items
- **Alif**: Sea water fish, fresh water fish, meat items

### How to Login
1. Select your butcher name from the dropdown
2. Click "Login"
3. You'll be taken to your personalized dashboard

### Logout
- Click the "Logout" button in the top navigation
- You'll be returned to the login screen

---

## 📋 Order Management

### Overview
The Order Management tab is your main workspace with three sections:
- **New Orders**: Incoming orders requiring attention
- **Preparing Orders**: Orders currently being prepared  
- **Completed Orders**: Finished orders with revenue details

### 🆕 Handling New Orders

#### When a New Order Arrives:
1. **Audio Alert**: System plays continuous beeping sound
2. **Visual Indicator**: Red notification badge shows order count
3. **Order Card**: Displays order details

#### Order Card Information:
- **Order Number**: Unique identifier (e.g., ORD-123)
- **Customer Name**: Customer details
- **Items**: List of requested items with quantities
- **Cut Type**: Specific preparation instructions
- **Size**: Item size specifications (fish hubs only)

#### Actions Available:
- **Accept**: Proceed to preparation weight entry
- **Reject**: Decline the order (requires reason)

### ✅ Accepting Orders

#### Step-by-Step Process:
1. **Click "Accept"** on the order card
2. **Preparation Weight Dialog** opens
3. **Enter weight for each item individually**:
   - Dialog shows: "Item 1 of 3: Ayala - Mackerel - അയല"
   - Enter preparation weight (e.g., 1.8)
   - Select unit (kg or g)
   - Click "Next Item" or "Accept and Start Preparing" for last item

#### Important Notes:
- **Multi-item orders**: You must enter weight for each item separately
- **Weight units**: Choose kg for standard weights, g for smaller amounts
- **Accuracy**: Enter actual picked weight, not ordered weight

### 🔄 Preparing Orders

#### Order Status During Preparation:
- **Timer**: 20-minute countdown starts automatically
- **Visual Indicator**: Timer turns red if exceeded
- **Status**: Shows "Preparing" in Google Sheets

#### Preparation Features:
- **Picked Weight Display**: Shows total preparation weight
- **Timer Display**: Shows elapsed time (e.g., "15m 30s")
- **Overdue Warning**: Red color when exceeding 20 minutes

### ✅ Completing Orders

#### When Order is Ready:
1. **Click "Mark as Prepared"**
2. **Final Weight Dialog** opens
3. **Enter final weight for each item**:
   - Shows preparation weight for reference
   - Enter actual final weight after processing
   - Select unit (kg or g)
   - Click "Next Item" or "Complete Order"

#### Automatic Calculations:
- **Revenue Calculation**: System fetches purchase price from Menu POS sheet
- **Formula**: (Purchase Price × Weight) - 7% commission
- **Completion Time**: Automatically calculated and stored
- **Status Update**: Changes to "Ready to Pick Up" in sheets

### 📊 Completed Orders

#### Information Displayed:
- **Final Weights**: Individual item weights
- **Preparation Time**: Total time taken
- **Revenue**: Butcher's earnings for the order
- **Completion Time**: When order was finished

---

## 🍖 Menu Management

### Overview
Manage your items, prices, and availability settings.

### Item Categories

#### For Meat Hubs (Usaj, PKD Stall):
- **Chicken**: Various cuts and preparations
- **Mutton**: Different parts and preparations  
- **Beef**: Various cuts (Usaj only)

#### For Fish Hubs (KAK, KA Sons, Alif):
- **Sea Water Fish**: Ocean fish varieties
- **Fresh Water Fish**: River/lake fish
- **Meat Items**: Additional meat products

### Managing Items

#### Item Settings:
- **Availability Toggle**: Turn items on/off
- **Price Entry**: Set price per kg
- **Unit Selection**: Choose 'weight' (kg) or 'nos' (pieces)
- **Size Options**: Default, Small, Big, Medium (fish hubs only)

#### For 'Weight' Items:
- Simply enter price per kg
- Customer orders by weight

#### For 'Nos' Items:
- Enter price per kg
- Set minimum and maximum weight range
- Example: Fish piece weighs 0.8kg - 2.0kg

#### Size Variations (Fish Hubs Only):
- **Default**: Standard size and pricing
- **Small/Big/Medium**: Different sizes with individual:
  - Price per kg
  - Minimum weight
  - Maximum weight

### Saving Changes
- Click "Save Menu" to update Google Sheets
- Changes sync automatically to the system
- Updated prices apply to new orders immediately

---

## 📊 Analytics Dashboard

### Overview
Track your business performance with real-time analytics.

### Key Metrics

#### Daily Summary:
- **Total Revenue Today**: Your earnings for the current day
- **Total Orders Today**: Number of orders processed
- **Total Weight Sold**: Combined weight of all items sold
- **Average Preparation Time**: Average time to complete orders

#### Detailed Analytics:
- **Revenue by Item**: Individual item performance
- **Weight Sold by Item**: Quantity sold per item
- **Order Completion Trends**: Performance over time
- **Peak Hours**: Busiest times of the day

### Data Refresh
- **Auto-refresh**: Updates every 30 seconds
- **Manual Refresh**: Click refresh button for instant update
- **Real-time**: Data reflects current Google Sheets status

---

## 🔧 Troubleshooting

### Common Issues

#### 🔊 Audio Alerts Not Working
**Problem**: No sound for new orders
**Solutions**:
- Check browser audio permissions
- Unmute browser tab
- Check system volume
- Try refreshing the page

#### 📶 Slow Loading/Updates
**Problem**: System seems slow or unresponsive
**Solutions**:
- Check internet connection
- Refresh the browser page
- Clear browser cache
- Wait for Google Sheets sync (15 seconds)

#### ❌ Orders Not Updating
**Problem**: Orders stuck in one status
**Solutions**:
- Wait 15 seconds for automatic refresh
- Click manual refresh button
- Check Google Sheets directly
- Verify internet connection

#### 💰 Wrong Revenue Calculations
**Problem**: Revenue doesn't match expected amount
**Solutions**:
- Verify purchase prices in Menu POS sheet
- Check if item names match exactly
- Ensure weights were entered correctly
- Formula: (Purchase Price × Weight) - 7%

#### 📱 Mobile Display Issues
**Problem**: System doesn't display properly on mobile
**Solutions**:
- Use landscape orientation
- Zoom out if needed
- Use desktop/tablet for better experience
- Ensure browser is up to date

### Error Messages

#### "API Rate Limit Exceeded"
- **Cause**: Too many Google Sheets requests
- **Solution**: Wait 1-2 minutes, system will auto-recover
- **Prevention**: Avoid rapid clicking/refreshing

#### "Failed to Fetch Orders"
- **Cause**: Network or Google Sheets connectivity issue
- **Solution**: Check internet, wait for auto-retry
- **Manual Fix**: Refresh page or click refresh button

#### "Item Not Found in Menu"
- **Cause**: Order item doesn't match menu items
- **Solution**: Check Menu Management tab for exact item names
- **Fix**: Update menu or contact admin

### Getting Help

#### Contact Support:
1. **Check this manual** for common solutions
2. **Review error messages** for specific guidance
3. **Try basic troubleshooting** (refresh, wait, retry)
4. **Contact system administrator** if issues persist

#### Information to Provide:
- Your butcher name
- What you were trying to do
- Error message (if any)
- Browser type and version
- Time when issue occurred

---

## 💡 Tips for Efficient Use

### Best Practices:

1. **Keep Browser Open**: Don't close tab to receive new order alerts
2. **Regular Breaks**: Take breaks to avoid fatigue during busy periods
3. **Accurate Weights**: Always enter precise weights for correct revenue
4. **Quick Response**: Accept/reject orders promptly to maintain customer satisfaction
5. **Menu Updates**: Keep prices current in Menu Management
6. **Monitor Timer**: Watch 20-minute preparation timer to maintain efficiency

### Keyboard Shortcuts:
- **Tab**: Navigate between input fields
- **Enter**: Submit forms/dialogs
- **Escape**: Close dialogs
- **Space**: Toggle switches/buttons

### Mobile Usage:
- **Portrait Mode**: For order lists and navigation
- **Landscape Mode**: For data entry and detailed views
- **Pinch to Zoom**: Adjust text size as needed

---

**📞 Need More Help?** Contact your system administrator or refer to the Technical Report for detailed system information.
