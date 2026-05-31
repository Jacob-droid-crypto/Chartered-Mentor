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
  examDuration: {
    type: Number,
    default: 180, // In minutes
  },
  uploadDuration: {
    type: Number,
    default: 15, // In minutes
  },
  startTime: {
    type: Date,
    default: null,
  },
  answerFileName: {
    type: String,
    default: null,
  },
  answerFileType: {
    type: String,
    default: null,
  },
  answerFileData: {
    type: String,
    default: null,
  },
  answerUploadedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("QuestionPaper", questionPaperSchema);
