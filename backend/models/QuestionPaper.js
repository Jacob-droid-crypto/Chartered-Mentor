const mongoose = require("mongoose");

const questionPaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  target: {
    type: String,
    required: true,
    // e.g., "ALL", "INTER", "FINAL", or a specific studentId like "FIN26102"
  },
  fileUrl: {
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
