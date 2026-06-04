const express = require("express");
const router = express.Router();
const { loginStudent, changePassword, getDashboard, scanQr, getDailyHours, updateProfile, forgotPassword, resetPassword, verifyGoogle, getStudentPapers, downloadPaper, startStudentExam, submitAnswerPaper, downloadStudentAnswerPaper, submitPayment, manualAttendance, getStudentSchedules, toggleScheduleStatus, downloadScheduleFile } = require("../controllers/studentController");
const { protect, studentOnly } = require("../middleware/authMiddleware");
const { getPaymentConfig, getGoalConfig } = require("../controllers/adminController");

router.post("/login", loginStudent);
router.post("/change-password", changePassword); 

router.get("/dashboard/:studentId", protect, studentOnly, getDashboard);
router.post("/scan-qr", protect, studentOnly, scanQr);
router.post("/manual-attendance", protect, studentOnly, manualAttendance);
router.get("/daily-hours/:studentId/:date", protect, studentOnly, getDailyHours);
router.post("/profile", protect, studentOnly, updateProfile);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-google", verifyGoogle);

// Papers
router.get("/papers", protect, studentOnly, getStudentPapers);
router.get("/paper/:id/download", protect, downloadPaper); // student or admin can download
router.post("/paper/:id/start", protect, studentOnly, startStudentExam);
router.post("/paper/:id/submit-answer", protect, studentOnly, submitAnswerPaper);
router.get("/paper/:id/download-answer", protect, studentOnly, downloadStudentAnswerPaper);

// Payments
router.get("/payment-config", protect, studentOnly, getPaymentConfig);
router.get("/goal-config", protect, studentOnly, getGoalConfig);
router.post("/payment", protect, studentOnly, submitPayment);

// Schedules
router.get("/schedules", protect, studentOnly, getStudentSchedules);
router.post("/schedule/:id/toggle", protect, studentOnly, toggleScheduleStatus);
router.get("/schedule/:id/download", protect, studentOnly, downloadScheduleFile);

module.exports = router;
