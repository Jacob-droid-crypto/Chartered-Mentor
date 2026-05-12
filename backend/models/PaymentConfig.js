const mongoose = require("mongoose");

const paymentConfigSchema = new mongoose.Schema({
  accountName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  ifscCode: { type: String, required: true },
  upiId: { type: String }
});

module.exports = mongoose.model("PaymentConfig", paymentConfigSchema);
