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

// --- READ -------------------------------------------------------
 
// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
 
// Get a user by ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
 
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
 
// --- UPDATE -----------------------------------------------------
 
// Update user details
router.put('/users/:id', async (req, res) => {
  try {
    const { name, dob, email, password } = req.body;
 
    const updatedUser = await User.findByIdAndUpdate(req.params.id, {
      name,
      dob,
      email,
      password: password ? await bcrypt.hash(password, 10) : undefined,
    }, { new: true });
 
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
 
    res.status(200).json({ message: 'User updated successfully', updatedUser });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
 
// --- DELETE -----------------------------------------------------
 
// Delete a user by ID
router.delete('/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
 
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
 
 

module.exports = router;
