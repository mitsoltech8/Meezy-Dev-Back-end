const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();


const SHOPIFY_ORDER_API_URL = process.env.SHOPIFY_ORDER_API_URL;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_AUTH; // Assuming the password is stored here for private apps

console.log('SHOPIFY_API_AUTH:', SHOPIFY_API_PASSWORD);

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



module.exports = router;
