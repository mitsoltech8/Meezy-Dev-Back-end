const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Profile = require('../models/profile.model');

const router = express.Router();


// Ensure the uploads directory exists
const uploadDirectory = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory);  // Create the directory if it doesn't exist
}

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),  // Save files to uploads directory
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.png');  // Ensure the file extension is preserved
    cb(null, req.user.id + '-' + Date.now() + ext);  // Name the file based on user ID and current timestamp
  }
});

const upload = multer({ storage });



// GET route to fetch profile
router.get('/me', auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });
    res.json(profile || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// POST route to create or update profile (including avatar upload)
router.post('/me', auth, upload.single('avatar'), async (req, res) => {
  const body = req.body;

  // If an avatar was uploaded, add its URL to the profile
  if (req.file) {
    body.avatarUrl = `/uploads/${req.file.filename}`;
  }

  const update = {
    firstName: body.firstName,
    lastName: body.lastName,
    dob: body.dob ? new Date(body.dob) : undefined,
    nationalId: body.nationalId,
    email: body.email,
    phone: body.phone,
    city: body.city,
    address: body.address,
    taxNumber: body.taxNumber,
    bankAccount: body.bankAccount,
    taxDetails: body.taxDetails,
    avatarUrl: body.avatarUrl  // Include avatar URL if available
  };

  try {
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { user: req.user.id, ...update } },
      { new: true, upsert: true }  // Create a new profile if not found
    );

    res.json({ message: 'Profile saved', profile });
  } catch (err) {
    console.error('Error saving profile:', err);
    res.status(500).json({ message: 'Error saving profile' });
  }
});


module.exports = router;