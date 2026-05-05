const mongoose = require("mongoose");

const questionPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  target: {
    type: String,
    required: true,
    // This will be a specific student's userId
  },
  fileName: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileData: {
    type: String,
    required: true,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("QuestionPaper", questionPaperSchema);
