const mongoose = require("mongoose");

const attendanceAdjustmentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    deductionMinutes: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    adjustedBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

attendanceAdjustmentSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceAdjustment", attendanceAdjustmentSchema);
