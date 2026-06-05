const mongoose = require("mongoose");

const goalConfigSchema = new mongoose.Schema({
  monday: { type: Number, default: 12 },
  tuesday: { type: Number, default: 12 },
  wednesday: { type: Number, default: 12 },
  thursday: { type: Number, default: 12 },
  friday: { type: Number, default: 12 },
  saturday: { type: Number, default: 12 },
  sunday: { type: Number, default: 0 },
  autoLogoutTime: { type: String, default: "22:00" },
  autoLogoutEnabled: { type: Boolean, default: true }
});

module.exports = mongoose.model("GoalConfig", goalConfigSchema);
