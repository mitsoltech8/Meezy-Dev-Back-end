const mongoose = require('mongoose');


const profileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  firstName: String,
  lastName: String,
  dob: { type: Date, required: true },
  nationalId: String,
  email: String,
  phone: String,
  city: String,
  address: String,
  taxNumber: String,
  bankAccount: String,
  taxDetails: String,
  avatarUrl: String, // store uploaded image url
}, { timestamps: true });


profileSchema.pre('save', function(next) {
  if (this.dob && isNaN(new Date(this.dob).getTime())) {
    next(new Error('Invalid Date'));
  } else {
    next();
  }
});

module.exports = mongoose.model('Profile', profileSchema);