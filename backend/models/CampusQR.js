const mongoose = require("mongoose");

const campusQRSchema = new mongoose.Schema({
  activeInToken: {
    type: String,
    default: "CM-ATTENDANCE-IN",
  },
  activeOutToken: {
    type: String,
    default: "CM-ATTENDANCE-OUT",
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("CampusQR", campusQRSchema);
