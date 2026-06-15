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
    enum: ["admin", "student", "staff"],
    required: true,
  },
  firstLogin: {
    type: Boolean,
    default: true,
  },
  address: {
    type: String,
  },
  group: {
    type: String,
    enum: ["Group 1", "Group 2", "Both"],
  },
  aadharNumber: {
    type: String,
  },
  fatherName: {
    type: String,
  },
  fatherPhone: {
    type: String,
  },
  fatherOccupation: {
    type: String,
  },
  motherName: {
    type: String,
  },
  motherPhone: {
    type: String,
  },
  motherOccupation: {
    type: String,
  },
  profileCompleted: {
    type: Boolean,
    default: false,
  },
  deviceFingerprint: {
    type: String,
  },
  batch: {
    type: String,
    enum: ["September 2026", "November 2026"],
  },
  dob: {
    type: Date,
  },
  joiningDate: {
    type: Date,
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
    receiptNo: String,
    installmentNumber: Number
  }],
  installments: [{
    amount: { type: Number, required: true },
    adjustedAmount: { type: Number },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    paidDate: { type: Date }
  }]
});

module.exports = mongoose.model("User", userSchema);
