const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: "",
  },
  target: {
    type: String,
    required: true,
    // This will be a specific student's userId
  },
  date: {
    type: Date,
    required: true,
  },
  startTime: {
    type: String,
    default: "",
  },
  endTime: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    enum: ["Pending", "Completed"],
    default: "Pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Schedule", scheduleSchema);
