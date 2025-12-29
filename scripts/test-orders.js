/**
 * Test script to push orders to fish and mixed butchers
 * Usage: node scripts/test-orders.js
 * 
 * Make sure to set API_SECRET in your .env file or use the default
 */

const API_SECRET = process.env.API_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test order for fish butcher (KAK)
const fishOrder = {
  orderNo: Date.now(), // Use timestamp as order number for uniqueness
  butcher: 'KAK',
  items: [
    {
      itemId: 'test-fish-1',
      name: 'Ayala - Mackerel - അയല',
      size: 'medium',
      quantityParsed: {
        value: 2,
        unit: 'kg'
      },
      cutType: 'whole'
    }
  ],
  timestamp: new Date().toISOString()
};

// Test order for mixed butcher (Tender Chops)
const mixedOrder = {
  orderNo: Date.now() + 1, // Different order number
  butcher: 'Tender Chops',
  items: [
    {
      itemId: 'test-mixed-1',
      name: 'chicken meat', // Meat item
      size: 'default',
      quantityParsed: {
        value: 1.5,
        unit: 'kg'
      },
      cutType: 'pieces'
    },
    {
      itemId: 'test-mixed-2',
      name: 'Ayala - Mackerel - അയല', // Fish item
      size: 'small',
      quantityParsed: {
        value: 1,
        unit: 'kg'
      },
      cutType: 'whole'
    }
  ],
  timestamp: new Date().toISOString()
};

async function sendOrder(order, butcherType) {
  try {
    console.log(`\n📦 Sending ${butcherType} order to ${order.butcher}...`);
    console.log(`   Order No: ${order.orderNo}`);
    console.log(`   Items: ${order.items.map(i => i.name).join(', ')}`);

    const response = await fetch(`${BASE_URL}/vcs/orders/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_SECRET}`
      },
      body: JSON.stringify(order)
    });

    const data = await response.json();

    if (response.ok) {
      console.log(`   ✅ Success: ${data.message}`);
      console.log(`   Order ID: ${data.orderId}`);
    } else {
      console.error(`   ❌ Error: ${data.error || data.message}`);
      console.error(`   Status: ${response.status}`);
    }

    return { success: response.ok, data };
  } catch (error) {
    console.error(`   ❌ Failed to send order:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🧪 Testing Order Push System');
  console.log('='.repeat(50));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Secret: ${API_SECRET.substring(0, 10)}...`);

  // Wait 2 seconds between orders
  const fishResult = await sendOrder(fishOrder, 'FISH');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mixedResult = await sendOrder(mixedOrder, 'MIXED');

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   Fish Butcher (KAK): ${fishResult.success ? '✅' : '❌'}`);
  console.log(`   Mixed Butcher (Tender Chops): ${mixedResult.success ? '✅' : '❌'}`);
  
  if (fishResult.success && mixedResult.success) {
    console.log('\n✅ All tests passed! Check the dashboard to see if orders appear.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { sendOrder, fishOrder, mixedOrder };

