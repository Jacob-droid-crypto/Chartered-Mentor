const express = require("express");
const router = express.Router();
const { loginStudent, changePassword, getDashboard, scanQr, getDailyHours, updateProfile, forgotPassword, resetPassword, getStudentPapers, downloadPaper } = require("../controllers/studentController");
const { protect, studentOnly } = require("../middleware/authMiddleware");

router.post("/login", loginStudent);
router.post("/change-password", changePassword); 

router.get("/dashboard/:studentId", protect, studentOnly, getDashboard);
router.post("/scan-qr", protect, studentOnly, scanQr);
router.get("/daily-hours/:studentId/:date", protect, studentOnly, getDailyHours);
router.post("/profile", protect, studentOnly, updateProfile);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Papers
router.get("/papers", protect, studentOnly, getStudentPapers);
router.get("/paper/:id/download", protect, downloadPaper); // student or admin can download

module.exports = router;
