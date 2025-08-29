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

// Delete a product by id
router.delete('/:id', async (req, res) => {
  const productId = req.params.id;
 
  try {
    console.log(`Deleting product with ID: ${productId}`);
 
    const deleteResponse = await axios.delete(
      `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`,
      { headers: getAuthHeader() }
    );
 
    console.log('✅ Product deleted successfully!');
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: deleteResponse.data || { deleted: true }
    });
 
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
 
    res.status(500).json({
      error: 'Error deleting product',
      message: error.message,
      shopifyError: error.response?.data
    });
  }
});

// Shopify Variant Delete Route using API_AUTH token
router.delete('/variants/:id', async (req, res) => {
  const variantId = req.params.id;
  if (!variantId) return res.status(400).json({ error: 'Variant ID required' });

  const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
  const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION;
  const SHOPIFY_API_AUTH = process.env.SHOPIFY_API_AUTH;

  if (!SHOPIFY_STORE || !SHOPIFY_API_AUTH || !SHOPIFY_API_VERSION) {
    return res.status(500).json({ error: 'Shopify config missing' });
  }

  try {
    const response = await fetch(
      `${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/variants/${variantId}.json`,
      {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_API_AUTH,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.text();
    if (!response.ok) {
      console.log('Shopify DELETE failed:', data);
      return res.status(response.status).send(data);
    }

    res.json({ success: true, message: 'Variant deleted successfully', shopifyResponse: data });
  } catch (error) {
    console.error('Variant deletion failed:', error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
