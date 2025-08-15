const express = require('express');
const axios = require('axios');
const router = express.Router();

// Get all products from Shopify
router.get('/', async (req, res) => {
  try {
    const response = await axios.get(process.env.SHOPIFY_API_URL, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
      },
    });
    res.json(response.data); // Return the products data
  } catch (error) {
    console.error('Error fetching products from Shopify:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

module.exports = router;
