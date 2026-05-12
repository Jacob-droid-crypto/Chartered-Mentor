const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const { loginAdmin, addStudent, getAttendance, getDailySummary, getStudents, deleteStudent, resetPassword, getProfile, uploadQuestionPaper, getAdminPapers, deletePaper, getPaymentConfig, updatePaymentConfig, updateStudentFees, addStudentPayment } = require("../controllers/adminController");
const { updateProfile } = require("../controllers/studentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.post("/login", loginAdmin);
router.get("/students", protect, adminOnly, getStudents);
router.post("/add-student", protect, adminOnly, addStudent);
router.delete("/student/:id", protect, adminOnly, deleteStudent);
router.post("/student/:id/reset-password", protect, adminOnly, resetPassword);
router.get("/attendance", protect, adminOnly, getAttendance);
router.get("/daily-summary", protect, adminOnly, getDailySummary);
router.post("/profile", protect, adminOnly, updateProfile);
router.get("/profile", protect, adminOnly, getProfile);

// Papers
router.post("/upload-paper", protect, adminOnly, upload.single("file"), uploadQuestionPaper);
router.get("/papers", protect, adminOnly, getAdminPapers);
router.delete("/paper/:id", protect, adminOnly, deletePaper);
// Payments
router.get("/payment-config", protect, adminOnly, getPaymentConfig);
router.post("/payment-config", protect, adminOnly, updatePaymentConfig);
router.post("/student/:studentId/fees", protect, adminOnly, updateStudentFees);
router.post("/student/:studentId/payment", protect, adminOnly, addStudentPayment);

module.exports = router;
