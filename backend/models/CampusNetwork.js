const mongoose = require("mongoose");

const campusNetworkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Network name is required"],
    trim: true,
  },
  ipOrRange: {
    type: String,
    required: [true, "IP Address or CIDR range is required"],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  addedBy: {
    type: String,
    default: "Admin",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("CampusNetwork", campusNetworkSchema);
