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
  seatNumber: {
    type: String,
    default: null
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
  feeRemarks: {
    type: String,
    default: ""
  },
  feeHistory: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Paid' },
    receiptNo: String,
    installmentNumber: Number,
    remarks: { type: String, default: "" }
  }],
  installments: [{
    amount: { type: Number, required: true },
    adjustedAmount: { type: Number },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ["Unpaid", "Paid"], default: "Unpaid" },
    paidDate: { type: Date },
    remarks: { type: String, default: "" }
  }],
  fines: [{
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    date: { type: Date, default: Date.now },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ["Unpaid", "Pending Approval", "Paid"], default: "Unpaid" },
    paymentMethod: { type: String, default: null },
    transactionId: { type: String, default: null },
    paidDate: { type: Date, default: null },
    notes: { type: String, default: null }
  }]
});

module.exports = mongoose.model("User", userSchema);
