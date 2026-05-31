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
  mode: {
    type: String,
    enum: ["residential", "online"],
    default: "residential"
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
  totalFees: {
    type: Number,
    default: 0
  },
  feesPaid: {
    type: Number,
    default: 0
  },
  nextPaymentDueDate: {
    type: Date
  },
  feeHistory: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Paid' },
    receiptNo: String
  }]
});

module.exports = mongoose.model("User", userSchema);
