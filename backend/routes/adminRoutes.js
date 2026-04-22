const express = require("express");
const router = express.Router();
const { loginAdmin, addStudent, getAttendance, getDailySummary, getStudents, deleteStudent, resetPassword, getProfile } = require("../controllers/adminController");
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

module.exports = router;
