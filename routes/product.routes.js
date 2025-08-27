const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();


const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://87eae6.myshopify.com';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_AUTH;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

// Helper function to get authorization header
const getAuthHeader = () => {
  const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
  return { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' };
};

// Update a product's price using variant endpoint
router.put('/:id', async (req, res) => {
  const productId = req.params.id;
  const { variantId, newPrice } = req.body;

  try {
    console.log(`Updating price for variant ID: ${variantId}, new price: ${newPrice}`);

    // Use the variant API endpoint directly (as you tested in Postman)
    const updateData = {
      variant: {
        id: variantId,
        price: newPrice
      }
    };

    // Send update request to variant endpoint
    const updateResponse = await axios.put(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`,
      updateData,
      { headers: getAuthHeader() }
    );

    console.log('✅ Price updated successfully!');
    res.json({
      success: true,
      message: 'Price updated successfully',
      data: updateResponse.data
    });

  } catch (error) {
    console.error('❌ Error updating product price:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }

    res.status(500).json({
      error: 'Error updating product price',
      message: error.message,
      shopifyError: error.response?.data
    });
  }
});

// Get all products (keep existing)
router.get('/', async (req, res) => {
  try {
    let allProducts = [];
    let nextPageUrl = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;

    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, { headers: getAuthHeader() });
      allProducts = allProducts.concat(response.data.products);

      const linkHeader = response.headers.link;
      if (linkHeader) {
        const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
        nextPageUrl = nextLink ? nextLink.split(';')[0].trim().slice(1, -1) : null;
      } else {
        nextPageUrl = null;
      }
    }

    res.json({ products: allProducts, count: allProducts.length });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// Get a single product by id (keep existing)
router.get('/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const response = await axios.get(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`,
      { headers: getAuthHeader() }
    );

    res.json(response.data.product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Error fetching product' });
  }
});



module.exports = router;
