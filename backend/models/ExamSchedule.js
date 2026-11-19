const mongoose = require("mongoose");

const examScheduleSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
  },
  studentName: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["Exam", "Schedule"],
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  examName: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ExamSchedule", examScheduleSchema);
