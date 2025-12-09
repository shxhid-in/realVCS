// Use built-in fetch (Node 18+) or require node-fetch
let fetch;
try {
  fetch = globalThis.fetch;
  if (!fetch) {
    fetch = require('node-fetch');
  }
} catch (e) {
  console.error('Error: fetch is not available. Please use Node.js 18+ or install node-fetch');
  process.exit(1);
}

// Get API_SECRET from environment or use default
const API_SECRET = process.env.API_SECRET || process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

const orderNo = Date.now(); // Use timestamp as order number
const timestamp = new Date().toISOString();

// VCS order format (as expected by /vcs/orders/new endpoint)
const order = {
  orderNo: orderNo,
  butcher: "Tender Chops", // Butcher name (not ID)
  items: [
    {
      itemId: "item-1",
      name: "chicken meat", // Will be kept as-is for meat items
      size: "", // Empty for meat items
      quantityParsed: {
        value: 2,
        unit: "kg"
      },
      cutType: ""
    },
    {
      itemId: "item-2",
      name: "sail fish meat", // Will be converted to three-language format for fish
      size: "", // Can be "small", "medium", "big" for fish
      quantityParsed: {
        value: 1.5,
        unit: "kg"
      },
      cutType: ""
    }
  ],
  timestamp: timestamp
};

console.log('Sending order to http://localhost:9002/vcs/orders/new');
console.log('Order No:', orderNo);
console.log('Butcher: Tender Chops');
console.log('Items:', order.items.length);
console.log('');

fetch('http://localhost:9002/vcs/orders/new', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_SECRET}`
  },
  body: JSON.stringify(order)
})
  .then(async res => {
    const data = await res.json();
    if (res.ok) {
      console.log('✅ SUCCESS!');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ ERROR:', res.status, res.statusText);
      console.log(JSON.stringify(data, null, 2));
    }
  })
  .catch(error => {
    console.error('❌ Request failed:', error.message);
  });
