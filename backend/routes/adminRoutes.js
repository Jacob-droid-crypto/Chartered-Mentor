const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const { loginAdmin, addStudent, getAttendance, getDailySummary, getStudents, deleteStudent, resetPassword, getProfile, uploadQuestionPaper, getAdminPapers, deletePaper, downloadAnswerPaper, getPaymentConfig, updatePaymentConfig, updateStudentFees, addStudentPayment, approveStudentPayment, rejectStudentPayment, editStudentPayment, revertStudentPayment, updateStudentProfileByAdmin, getGoalConfig, updateGoalConfig, manualCheckout, createSchedule, getAdminSchedules, deleteSchedule, downloadScheduleFileAdmin } = require("../controllers/adminController");
const { updateProfile } = require("../controllers/studentController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.post("/login", loginAdmin);
router.get("/students", protect, adminOnly, getStudents);
router.post("/add-student", protect, adminOnly, addStudent);
router.delete("/student/:id", protect, adminOnly, deleteStudent);
router.post("/student/:id/reset-password", protect, adminOnly, resetPassword);
router.get("/attendance", protect, adminOnly, getAttendance);
router.post("/attendance/manual-checkout", protect, adminOnly, manualCheckout);
router.get("/daily-summary", protect, adminOnly, getDailySummary);
router.post("/profile", protect, adminOnly, updateProfile);
router.get("/profile", protect, adminOnly, getProfile);

// Schedules
router.post("/schedule", protect, adminOnly, upload.single("file"), createSchedule);
router.get("/schedules", protect, adminOnly, getAdminSchedules);
router.delete("/schedule/:id", protect, adminOnly, deleteSchedule);
router.get("/schedule/:id/download", protect, adminOnly, downloadScheduleFileAdmin);

// Papers
router.post("/upload-paper", protect, adminOnly, upload.single("file"), uploadQuestionPaper);
router.get("/papers", protect, adminOnly, getAdminPapers);
router.delete("/paper/:id", protect, adminOnly, deletePaper);
router.get("/paper/:id/download-answer", protect, adminOnly, downloadAnswerPaper);
// Payments
router.get("/payment-config", protect, adminOnly, getPaymentConfig);
router.post("/payment-config", protect, adminOnly, updatePaymentConfig);
router.get("/goal-config", protect, adminOnly, getGoalConfig);
router.post("/goal-config", protect, adminOnly, updateGoalConfig);
router.post("/student/:studentId/fees", protect, adminOnly, updateStudentFees);
router.post("/student/:studentId/payment", protect, adminOnly, addStudentPayment);
router.post("/student/:studentId/profile", protect, adminOnly, updateStudentProfileByAdmin);

// Payment Approvals
router.post("/student/:studentId/payment/:paymentId/approve", protect, adminOnly, approveStudentPayment);
router.post("/student/:studentId/payment/:paymentId/reject", protect, adminOnly, rejectStudentPayment);
router.post("/student/:studentId/payment/:paymentId/edit", protect, adminOnly, editStudentPayment);
router.post("/student/:studentId/payment/:paymentId/revert", protect, adminOnly, revertStudentPayment);

module.exports = router;






