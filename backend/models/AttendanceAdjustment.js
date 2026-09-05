const mongoose = require("mongoose");

const attendanceAdjustmentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    type: { type: String, enum: ["ADD", "DEDUCT"], default: "DEDUCT" },
    minutes: { type: Number, default: 0, min: 0 },
    deductionMinutes: { type: Number, default: 0, min: 0 }, // Retained for backward compatibility
    reason: { type: String, required: true },
    adjustedBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

attendanceAdjustmentSchema.index({ studentId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceAdjustment", attendanceAdjustmentSchema);

