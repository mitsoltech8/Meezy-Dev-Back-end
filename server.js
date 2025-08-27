const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');  // To handle CORS issues
const productRoutes = require('./routes/product.routes')
const mongoose = require('mongoose');
const registerRoutes = require('./routes/user.routes');
const profileRoutes = require('./routes/profile.routes');
const orderRoutes = require('./routes/orders.routes');
const path = require('path');

dotenv.config(); // Load environment variables

const app = express();

app.use(cors());
app.use(express.json()); 

// static files for uploaded avatars
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// MongoDB connection
const dbURI = 'mongodb://mongo:BrsXVvcmBWamnSXPizQzXPnJPPKxLNXM@tramway.proxy.rlwy.net:15894'; 
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Example route
app.get('/', (req, res) => {
  res.send('Hello, welcome to the Shopify API!');
});

// Importing products route
// const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/user', registerRoutes);
app.use('/api/profile', profileRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
