const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();


const SHOPIFY_ORDER_API_URL = process.env.SHOPIFY_ORDER_API_URL;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_AUTH; // Assuming the password is stored here for private apps
 
console.log('SHOPIFY_API_AUTH:', SHOPIFY_API_PASSWORD);
 
 
const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
 
 
 
// Get all products from Shopify
router.get('/', async (req, res) => {
  try {
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_PASSWORD) {
      return res.status(500).json({ error: 'API key or password is missing' });
    }
 
    // Correct way to authenticate using API Key and Password for private apps
    const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
 
    const response = await axios.get(SHOPIFY_ORDER_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`, // Use Basic Auth with API Key and Password
      },
    });
 
    res.json(response.data); // Return the products data
  } catch (error) {
    console.error('Error fetching products from Shopify:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});
 


// Get single order by ID from Shopify
router.get('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    if (!SHOPIFY_API_KEY || !SHOPIFY_API_PASSWORD) {
      return res.status(500).json({ error: 'API key or password is missing' });
    }
 
    const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
 
    const response = await axios.get(`${SHOPIFY_ORDER_API_URL}/${orderId}.json`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });
 
    res.json(response.data); // Return the single order data
  } catch (error) {
    console.error('Error fetching order from Shopify:', error);
    // More specific error handling
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Error fetching order' });
  }
});


// PUT route to handle status update
router.put('/update-status', async (req, res) => {
  const { status, products } = req.body;
 
  if (!status || !products || products.length === 0) {
    return res.status(400).json({ error: 'Invalid input' });
  }
 
  try {
    for (let productId of products) {
      // Update the order status on Shopify
      const response = await axios.put(
        `${SHOPIFY_ORDER_API_URL}/${productId}.json`,
        {
          order: {
            id: productId,
            financial_status: status // Update the status (Confirmed, Transferred, Cancelled)
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
        }
      );
 
      // If Shopify response is not OK, handle failure
      if (response.status !== 200) {
        throw new Error(`Failed to update status for product ${productId}`);
      }
    }
 
    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Error updating status' });
  }
});
 
 
 
 
 
// Create a new order in Shopify
router.post('/', async (req, res) => {
  try {
    const orderData = req.body; // Assuming the order data is sent in the request body
 
    if (!orderData) {
      return res.status(400).json({ error: 'Order data is required' });
    }
 
    const response = await axios.post(SHOPIFY_ORDER_API_URL, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });
 
    res.status(201).json(response.data); // Return the created order data
  } catch (error) {
    console.error('Error creating order in Shopify:', error);
    res.status(500).json({ error: 'Error creating order' });
  }
});
 
// Update an existing order in Shopify
router.put('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderData = req.body;
 
    if (!orderData) {
      return res.status(400).json({ error: 'Order data is required' });
    }
 
    const response = await axios.put(`${SHOPIFY_ORDER_API_URL}/${orderId}.json`, orderData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });
 
    res.json(response.data); // Return the updated order data
  } catch (error) {
    console.error('Error updating order in Shopify:', error);
    res.status(500).json({ error: 'Error updating order' });
  }
});
 
// Delete an order from Shopify
router.delete('/:id', async (req, res) => {
  try {
    const orderId = req.params.id;
 
    const response = await axios.delete(`${SHOPIFY_ORDER_API_URL}/${orderId}.json`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
    });
 
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order from Shopify:', error);
    res.status(500).json({ error: 'Error deleting order' });
  }
});
 


module.exports = router;
