const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  phone: {
    type: String,
  },
  profilePhoto: {
    type: String,
  },
  age: {
    type: Number,
  },
  course: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "student"],
    required: true,
  },
  firstLogin: {
    type: Boolean,
    default: true,
  },
  resetPasswordOtp: {
    type: String,
  },
  resetPasswordExpire: {
    type: Date,
  },
});

module.exports = mongoose.model("User", userSchema);
