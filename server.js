const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');  // To handle CORS issues
const productRoutes = require('./routes/product.routes')

dotenv.config(); // Load environment variables

const app = express();

app.use(cors());
app.use(express.json()); // For parsing application/json

// Example route
app.get('/', (req, res) => {
  res.send('Hello, welcome to the Shopify API!');
});

// Importing products route
// const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
