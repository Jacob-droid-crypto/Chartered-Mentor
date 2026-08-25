const express = require("express");
const router = express.Router();
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const { loginAdmin, addStudent, getAttendance, getDailySummary, getStudents, deleteStudent, resetPassword, getProfile, uploadQuestionPaper, getAdminPapers, deletePaper, downloadAnswerPaper, getPaymentConfig, updatePaymentConfig, updateStudentFees, addStudentPayment, approveStudentPayment, rejectStudentPayment, editStudentPayment, revertStudentPayment, updateStudentProfileByAdmin, getGoalConfig, updateGoalConfig, deleteGoalConfig, manualCheckout, manualCheckin, createSchedule, getAdminSchedules, deleteSchedule, downloadScheduleFileAdmin, getExamSchedules, createExamSchedule, updateExamSchedule, deleteExamSchedule, getCampusQR, refreshCampusQR, resetStudentDevice, triggerAutoLogout, applyFine, deleteFine, payFine } = require("../controllers/adminController");
const { updateProfile } = require("../controllers/studentController");
const { protect, adminOnly, adminRoleRequired } = require("../middleware/authMiddleware");

router.get("/cron-auto-logout", triggerAutoLogout);
router.get("/campus-qr", protect, adminOnly, getCampusQR);
router.post("/campus-qr/refresh", protect, adminOnly, refreshCampusQR);

router.post("/login", loginAdmin);
router.get("/students", protect, adminOnly, getStudents);
router.post("/add-student", protect, adminOnly, addStudent);
router.delete("/student/:id", protect, adminRoleRequired, deleteStudent);
router.post("/student/:id/reset-password", protect, adminOnly, resetPassword);
router.post("/student/:id/reset-device", protect, adminOnly, resetStudentDevice);
router.get("/attendance", protect, adminOnly, getAttendance);
router.post("/attendance/manual-checkout", protect, adminOnly, manualCheckout);
router.post("/attendance/manual-checkin", protect, adminOnly, manualCheckin);
router.get("/daily-summary", protect, adminOnly, getDailySummary);
router.post("/profile", protect, adminOnly, updateProfile);
router.get("/profile", protect, adminOnly, getProfile);

// Schedules
router.post("/schedule", protect, adminOnly, upload.single("file"), createSchedule);
router.get("/schedules", protect, adminOnly, getAdminSchedules);
router.delete("/schedule/:id", protect, adminRoleRequired, deleteSchedule);
router.get("/schedule/:id/download", protect, adminOnly, downloadScheduleFileAdmin);

// Exam Schedules
router.get("/exam-schedules", protect, adminOnly, getExamSchedules);
router.post("/exam-schedules", protect, adminOnly, createExamSchedule);
router.put("/exam-schedules/:id", protect, adminOnly, updateExamSchedule);
router.delete("/exam-schedules/:id", protect, adminRoleRequired, deleteExamSchedule);

// Papers
router.post("/upload-paper", protect, adminOnly, upload.single("file"), uploadQuestionPaper);
router.get("/papers", protect, adminOnly, getAdminPapers);
router.delete("/paper/:id", protect, adminRoleRequired, deletePaper);
router.get("/paper/:id/download-answer", protect, adminOnly, downloadAnswerPaper);
// Payments
router.get("/payment-config", protect, adminRoleRequired, getPaymentConfig);
router.post("/payment-config", protect, adminRoleRequired, updatePaymentConfig);
router.get("/goal-config", protect, adminOnly, getGoalConfig);
router.post("/goal-config", protect, adminOnly, updateGoalConfig);
router.delete("/goal-config/:id", protect, adminRoleRequired, deleteGoalConfig);
router.post("/student/:studentId/fees", protect, adminRoleRequired, updateStudentFees);
router.post("/student/:studentId/payment", protect, adminRoleRequired, addStudentPayment);
router.post("/student/:studentId/profile", protect, adminOnly, updateStudentProfileByAdmin);

// Payment Approvals
router.post("/student/:studentId/payment/:paymentId/approve", protect, adminRoleRequired, approveStudentPayment);
router.post("/student/:studentId/payment/:paymentId/reject", protect, adminRoleRequired, rejectStudentPayment);
router.post("/student/:studentId/payment/:paymentId/edit", protect, adminRoleRequired, editStudentPayment);
router.post("/student/:studentId/payment/:paymentId/revert", protect, adminRoleRequired, revertStudentPayment);


// Fines
router.post("/student/:studentId/fine", protect, adminOnly, applyFine);
router.post("/student/:studentId/fine/:fineId/pay", protect, adminOnly, payFine);
router.delete("/student/:studentId/fine/:fineId", protect, adminOnly, deleteFine);

module.exports = router;






