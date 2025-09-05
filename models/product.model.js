const mongoose = require('mongoose');


// In your product.model.js
const productSchema = new mongoose.Schema({
  shopifyId: String, // Store the Shopify ID
  title: String,
  // other fields...
  variants: [{
    id: String, // Shopify variant ID
    price: Number,
    option1: String,
    // other variant fields...
  }],
  changedBy: mongoose.Schema.Types.ObjectId,
  changedAt: Date
});


const Product = mongoose.model('Product', productSchema);
module.exports = Product;