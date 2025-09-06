const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();


// --- ENV ---
const SHOPIFY_STORE_URL   = process.env.SHOPIFY_STORE_URL || 'https://87eae6.myshopify.com';
const SHOPIFY_API_KEY     = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_PASSWORD= process.env.SHOPIFY_API_AUTH; // you were using this already
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const SHOPIFY_LOCATION_ID = process.env.SHOPIFY_LOCATION_ID; // e.g. 87940333864 (required)
 
// --- AUTH (Basic, consistent everywhere) ---
const getAuthHeader = () => {
  const auth = Buffer.from(`${SHOPIFY_API_KEY}:${SHOPIFY_API_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
};
 
const shopify = axios.create({
  baseURL: `${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`,
  headers: getAuthHeader(),
});
 
// --- Helpers ---
/**
* Fetch a single variant from Shopify (ensures we have inventory_item_id)
* @param {string|number} variantId
* @returns {Promise<object>} variant
*/
async function getVariant(variantId) {
  const { data } = await shopify.get(`/variants/${variantId}.json`);
  // data = { variant: {...} }
  return data.variant;
}
 
/**
* Set available inventory to EXACTLY 1 for (inventory_item_id, location_id)
* Uses Inventory Levels "set" endpoint.
* @param {string|number} inventoryItemId
* @param {string|number} locationId
* @returns {Promise<object>} inventory_level
*/
async function setInventoryToOne(inventoryItemId, locationId) {
  const payload = {
    location_id: Number(locationId),
    inventory_item_id: Number(inventoryItemId),
    available: 1, // absolute set, not adjust
  };
  const { data } = await shopify.post('/inventory_levels/set.json', payload);
  // data = { inventory_level: {...} }
  return data.inventory_level;
}
 
/**
* For a list of inventory_item_ids, fetch inventory levels at a single location.
* @param {Array<string|number>} inventoryItemIds
* @param {string|number} locationId
* @returns {Promise<Array<{inventory_item_id:number, available:number}>>}
*/
async function getInventoryForItemsAtLocation(inventoryItemIds, locationId) {
  if (!inventoryItemIds.length) return [];
  const idsParam = inventoryItemIds.map(String).join(',');
  const { data } = await shopify.get(`/inventory_levels.json`, {
    params: {
      inventory_item_ids: idsParam,
      location_ids: String(locationId),
      limit: 250,
    },
  });
  // data = { inventory_levels: [ {inventory_item_id, location_id, available, ...}, ...] }
  return (data.inventory_levels || []).map(l => ({
    inventory_item_id: l.inventory_item_id,
    available: typeof l.available === 'number' ? l.available : null,
  }));
}
 
// ----------------------------- ROUTES ---------------------------------
 
// Update variant price AND lock stock to 1 (atomic behavior for your use case)
router.put('/:id', async (req, res) => {
  const productId = req.params.id;
  const { variantId, newPrice } = req.body;
 
  if (!variantId || newPrice === undefined || newPrice === null) {
    return res.status(400).json({ error: 'variantId and newPrice are required' });
  }
  if (!SHOPIFY_LOCATION_ID) {
    return res.status(500).json({ error: 'SHOPIFY_LOCATION_ID missing in environment' });
  }
 
  try {
    // 1) Update price via Variant API
    const updateData = { variant: { id: Number(variantId), price: String(newPrice) } };
    const { data: updateResp } = await shopify.put(`/variants/${variantId}.json`, updateData);
    // updateResp = { variant: {...} }
    const updatedVariant = updateResp.variant;
 
    // 2) Get inventory_item_id (try to pick from update response; if missing, fetch)
    const inventoryItemId = updatedVariant?.inventory_item_id
      ? updatedVariant.inventory_item_id
      : (await getVariant(variantId)).inventory_item_id;
 
    if (!inventoryItemId) {
      return res.status(500).json({ error: 'inventory_item_id not found for variant' });
    }
 
    // 3) Lock qty to 1 at your location
    const invLevel = await setInventoryToOne(inventoryItemId, SHOPIFY_LOCATION_ID);
 
    // 4) Respond with merged info
    return res.json({
      success: true,
      message: 'Price updated and stock locked to 1',
      productId,
      variantId: Number(variantId),
      newPrice: String(newPrice),
      inventory: {
        location_id: Number(SHOPIFY_LOCATION_ID),
        inventory_item_id: inventoryItemId,
        available: invLevel?.available ?? 1,
      },
      variant: {
        id: updatedVariant.id,
        price: updatedVariant.price,
        sku: updatedVariant.sku,
        inventory_item_id: inventoryItemId,
      },
    });
  } catch (error) {
    console.error('❌ Price/stock update failed:', error?.response?.data || error.message);
    return res.status(500).json({
      error: 'Error updating price/stock',
      details: error?.response?.data || error.message,
    });
  }
});
 
// Get ALL products (no 50 limit)
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
    console.error('Error fetching products:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching products' });
  }
});
 
// Get a single product by id
// - Normal mode returns the Shopify product JSON
// - If `?includeStock=1`, also returns a `stock` array with { variantId, inventory_item_id, available }
router.get('/:id', async (req, res) => {
  const productId = req.params.id;
  const includeStock = String(req.query.includeStock || '') === '1';
 
  try {
    const { data } = await shopify.get(`/products/${productId}.json`);
    const product = data.product;
 
    if (!includeStock) {
      return res.json(product);
    }
 
    // include live stock at your single location
    const variants = product.variants || [];
    const items = variants
      .filter(v => v.inventory_item_id) // should be present
      .map(v => ({ variantId: v.id, inventory_item_id: v.inventory_item_id }));
 
    const invLevels = await getInventoryForItemsAtLocation(
      items.map(i => i.inventory_item_id),
      SHOPIFY_LOCATION_ID
    );
 
    // map back by inventory_item_id
    const byItem = new Map(invLevels.map(l => [Number(l.inventory_item_id), l.available]));
 
    const stock = items.map(i => ({
      variantId: i.variantId,
      inventory_item_id: i.inventory_item_id,
      available: byItem.has(Number(i.inventory_item_id)) ? byItem.get(Number(i.inventory_item_id)) : null,
    }));
 
    return res.json({ product, stock });
  } catch (error) {
    console.error('Error fetching product:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error fetching product' });
  }
});
 
// Optional: hard-delete a product
router.delete('/:id', async (req, res) => {
  const productId = req.params.id;
  try {
    const { data } = await shopify.delete(`/products/${productId}.json`);
    res.json({ success: true, message: 'Product deleted', data: data || { deleted: true } });
  } catch (error) {
    console.error('Delete failed:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error deleting product', details: error?.response?.data || error.message });
  }
});
 
// Optional: DELETE a variant (kept, but now using the same Basic auth)
router.delete('/variants/:id', async (req, res) => {
  const variantId = req.params.id;
  if (!variantId) return res.status(400).json({ error: 'Variant ID required' });
  try {
    const { data } = await shopify.delete(`/variants/${variantId}.json`);
    res.json({ success: true, message: 'Variant deleted', data });
  } catch (error) {
    console.error('Variant deletion failed:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Error deleting variant', details: error?.response?.data || error.message });
  }
});

module.exports = router;
