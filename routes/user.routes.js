const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/user.model'); // Import the User model


function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });
}

// POST route to handle user registration
router.post('/register', async (req, res) => {
  const { name, dob, email, password } = req.body;

  try {
    // Check if the user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create a new user
    const newUser = new User({
      name,
      dob,
      email,
      password
    });

    // Save the user to the database
    await newUser.save();
    const token = signToken(newUser._id);

    res.status(201).json({ 
    message: 'User registered successfully',
    token,
    user: {id: newUser._id, name: newUser.name, email: newUser.email}
   });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
