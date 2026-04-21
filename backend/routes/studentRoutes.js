const express = require("express");
const router = express.Router();
const { loginStudent, changePassword, getDashboard, scanQr, getDailyHours } = require("../controllers/studentController");
const { protect, studentOnly } = require("../middleware/authMiddleware");

router.post("/login", loginStudent);
router.post("/change-password", changePassword); // Allow without protect to change temp pass? Actually, normally protect this, but keeping as original logic for now.

router.get("/dashboard/:studentId", protect, studentOnly, getDashboard);
router.post("/scan-qr", protect, studentOnly, scanQr);
router.get("/daily-hours/:studentId/:date", protect, studentOnly, getDailyHours);

module.exports = router;
