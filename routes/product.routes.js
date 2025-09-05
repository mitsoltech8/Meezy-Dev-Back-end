const express = require('express');
const axios = require('axios');
const router = express.Router();
const Product = require('../models/product.model');
const mongoose = require('mongoose');
require('dotenv').config();


const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || 'https://87eae6.myshopify.com';
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_AUTH;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const SHOPIFY_LOCATION_ID = process.env.SHOPIFY_LOCATION_ID; // << REQUIRED for inventory

// ---- Auth helpers ----
const getBasicAuthHeader = () => {
  const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
};

// Axios instance (basic)
const shopify = axios.create({
  baseURL: `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`,
  headers: getBasicAuthHeader(),
});

// ---- Inventory helpers ----

// Get one Shopify product (ensures we have inventory_item_id for variants)
async function getShopifyProduct(productId) {
  const { data } = await shopify.get(`/products/${productId}.json`);
  return data.product;
}

// Get available qty for a list of inventory_item_ids at a single location
// Returns Map<inventory_item_id, available>
async function getAvailableForInventoryItems(inventoryItemIds = []) {
  if (!SHOPIFY_LOCATION_ID) {
    throw new Error('SHOPIFY_LOCATION_ID is not set in environment');
  }
  if (!inventoryItemIds.length) return new Map();

  // Shopify allows many IDs, but we’ll chunk to 40 per call to be safe
  const chunk = (arr, size) => arr.reduce((a, _, i) => (i % size ? a : [...a, arr.slice(i, i + size)]), []);
  const chunks = chunk(inventoryItemIds, 40);

  const results = new Map();
  for (const group of chunks) {
    const params = new URLSearchParams({
      inventory_item_ids: group.join(','),
      location_ids: SHOPIFY_LOCATION_ID,
      limit: '250',
    });
    const { data } = await shopify.get(`/inventory_levels.json?${params.toString()}`);
    // data.inventory_levels: [{ inventory_item_id, available, location_id, updated_at }]
    for (const lvl of data.inventory_levels || []) {
      results.set(String(lvl.inventory_item_id), Number(lvl.available ?? 0));
    }
  }
  return results;
}

// Build a variant → available map for a given productId
async function getVariantAvailability(productId) {
  const product = await getShopifyProduct(productId);
  const inventoryIds = product.variants.map(v => String(v.inventory_item_id));
  const availMap = await getAvailableForInventoryItems(inventoryIds);

  // Return array aligned to variants
  return product.variants.map(v => ({
    variantId: String(v.id),
    inventory_item_id: String(v.inventory_item_id),
    available: Number(availMap.get(String(v.inventory_item_id)) ?? 0),
  }));
}

// ---- Sync Products (unchanged logic + minor hardening) ----
const syncProductsToDatabase = async () => {
  try {
    console.log('Syncing products from Shopify to database...');
    let allProducts = [];
    let nextPageUrl = `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=250`;

    while (nextPageUrl) {
      const response = await axios.get(nextPageUrl, { headers: getBasicAuthHeader() });
      allProducts = allProducts.concat(response.data.products);

      const linkHeader = response.headers.link;
      if (linkHeader) {
        const nextLink = linkHeader.split(',').find(link => link.includes('rel="next"'));
        nextPageUrl = nextLink ? nextLink.split(';')[0].trim().slice(1, -1) : null;
      } else {
        nextPageUrl = null;
      }
    }

    for (const product of allProducts) {
      // Preserve your existing schema fields; we don’t enforce schema for inventory here
      await Product.findOneAndUpdate(
        { shopifyId: product.id.toString() },
        {
          $set: {
            shopifyId: product.id.toString(),
            title: product.title,
            variants: product.variants.map(variant => ({
              id: variant.id.toString(),
              price: variant.price,
              option1: variant.option1,
              // we don’t persist inventory fields to avoid schema mismatch
            })),
          }
        },
        { upsert: true, new: true }
      );
    }

    console.log(`✅ Successfully synced ${allProducts.length} products to database`);
  } catch (error) {
    console.error('❌ Error syncing products to database:', error.message);
  }
};

// Kick off once at boot (as before)
syncProductsToDatabase();

// ---- Update Variant Price (as you had) ----
router.put('/:id', async (req, res) => {
  const shopifyProductId = req.params.id;
  const { variantId, newPrice, userId } = req.body;

  try {
    const updateData = { variant: { id: variantId, price: newPrice } };
    const updateResponse = await shopify.put(`/variants/${variantId}.json`, updateData);

    // ensure product exists in DB; if not, fetch and create
    let product = await Product.findOne({ shopifyId: shopifyProductId });
    if (!product) {
      const shopifyProduct = await getShopifyProduct(shopifyProductId);
      product = await Product.create({
        shopifyId: shopifyProduct.id.toString(),
        title: shopifyProduct.title,
        variants: shopifyProduct.variants.map(v => ({
          id: v.id.toString(),
          price: v.price,
          option1: v.option1,
        })),
      });
    }

    const variantIndex = product.variants.findIndex(v => v.id === String(variantId));
    if (variantIndex === -1) {
      return res.status(404).json({ message: 'Variant not found in database' });
    }

    product.variants[variantIndex].price = newPrice;
    product.changedBy = userId;
    product.changedAt = new Date();
    await product.save();

    res.json({
      success: true,
      message: 'Price updated successfully in both Shopify and Database',
      data: updateResponse.data,
      updatedProduct: product
    });
  } catch (error) {
    console.error('❌ Error updating product price:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ---- List products (unchanged) ----
router.get('/', async (req, res) => {
  try {
    const { updatedOnly, page = 1, limit = 50, q } = req.query;

    const filter = {};
    if (updatedOnly === 'true' || updatedOnly === '1') {
      filter.changedBy = { $exists: true, $ne: null };
    }
    if (q) {
      const re = new RegExp(q, 'i');
      filter.$or = [
        { title: re },
        { shopifyId: re },
        { 'variants.option1': re },
        { 'variants.title': re },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      count: products.length,
      total,
      page: pageNum,
      limit: limitNum,
      updatedOnly: !!(updatedOnly === 'true' || updatedOnly === '1'),
    });
  } catch (error) {
    console.error('Error fetching products from database:', error);
    res.status(500).json({ error: 'Error fetching products' });
  }
});

// ---- Get single product (NEW: includeStock support) ----
// /api/products/:id?includeStock=1
router.get('/:id', async (req, res) => {
  const productId = String(req.params.id);
  const includeStock = req.query.includeStock === '1' || req.query.includeStock === 'true';

  try {
    // Try DB by ObjectId
    let productDoc = null;
    const looksLikeObjectId = /^[0-9a-fA-F]{24}$/.test(productId);
    if (looksLikeObjectId) {
      productDoc = await Product.findById(productId).lean();
    }
    // Try DB by shopifyId
    if (!productDoc) {
      productDoc = await Product.findOne({ shopifyId: productId }).lean();
    }

    if (productDoc) {
      if (!includeStock) {
        return res.json({ source: 'db', product: productDoc });
      }
      // load stock live from Shopify for this productId (shopifyId)
      const stock = await getVariantAvailability(productDoc.shopifyId);
      return res.json({ source: 'db', product: productDoc, stock });
    }

    // Fallback: Shopify
    const product = await getShopifyProduct(productId);
    if (!includeStock) {
      return res.json({ source: 'shopify', product });
    }
    const stock = await getVariantAvailability(productId);
    return res.json({ source: 'shopify', product, stock });
  } catch (error) {
    console.error('Error fetching product:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Error fetching product' });
  }
});

// ---- NEW: explicit inventory endpoint ----
// /api/products/:id/inventory  -> { locationId, variants: [{variantId, inventory_item_id, available}] }
router.get('/:id/inventory', async (req, res) => {
  try {
    const productId = String(req.params.id);
    const variants = await getVariantAvailability(productId);
    res.json({
      locationId: SHOPIFY_LOCATION_ID || null,
      variants
    });
  } catch (error) {
    console.error('Error fetching inventory:', error?.response?.data || error.message || error);
    res.status(500).json({ error: 'Error fetching inventory' });
  }
});

// ---- Delete product (unchanged) ----
router.delete('/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const deleteResponse = await shopify.delete(`/products/${productId}.json`);
    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: deleteResponse.data || { deleted: true }
    });
  } catch (error) {
    console.error('❌ Error deleting product:', error.message);
    res.status(500).json({
      error: 'Error deleting product',
      message: error.message,
      shopifyError: error.response?.data
    });
  }
});

// ---- Delete variant (unchanged behavior, normalized to axios) ----
router.delete('/variants/:id', async (req, res) => {
  const variantId = req.params.id;
  if (!variantId) return res.status(400).json({ error: 'Variant ID required' });

  try {
    const response = await shopify.delete(`/variants/${variantId}.json`);
    res.json({ success: true, message: 'Variant deleted successfully', shopifyResponse: response.data || { deleted: true } });
  } catch (error) {
    console.error('Variant deletion failed:', error?.response?.data || error.message || error);
    res.status(500).json({ error: error.message, shopifyError: error.response?.data });
  }
});

module.exports = router;
