const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
  });
};

/* ================= ADMIN LOGIN ================= */
const loginAdmin = async (req, res) => {
  try {
    const { userId, password } = req.body;

    const admin = await User.findOne({ userId, role: "admin" });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      firstLogin: admin.firstLogin,
      token: generateToken(admin.userId, admin.role),
    });
  } catch (err) {
    console.error("Login Admin Error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

/* ================= ADD STUDENT ================= */
const addStudent = async (req, res) => {
  try {
    const { name, email, age, course } = req.body;

    if (!name || !email || !age || !course) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const exists = await User.findOne({ email, role: "student" });
    if (exists) {
      return res.json({
        message: "Student already exists",
        userId: exists.userId,
      });
    }

    let coursePrefix = "GEN";
    if (course === "INTER") coursePrefix = "INT";
    else if (course === "FINAL") coursePrefix = "FIN";

    const year = new Date().getFullYear().toString().slice(-2);
    const count = await User.countDocuments({ role: "student", course: course });
    const admissionNumber = 101 + count;
    const studentId = `${coursePrefix}${year}${admissionNumber}`;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
    let plainPassword = "";
    for (let i = 0; i < 10; i++) {
        plainPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await User.create({
      userId: studentId,
      name,
      email,
      age,
      course,
      password: hashedPassword,
      role: "student",
      firstLogin: true,
    });

    res.json({
      userId: studentId,
      password: plainPassword,
    });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN VIEW ATTENDANCE ================= */
const getAttendance = async (req, res) => {
  try {
    const records = await Attendance.find().sort({ timestamp: -1 });

    const cleaned = records.map((r) => {
      const d = new Date(r.timestamp);
      return {
        studentId: r.studentId,
        course: r.course || "-",
        date: r.date,
        time: isNaN(d.getTime()) ? "-" : d.toLocaleTimeString(),
        type: r.type || "-",
      };
    });

    res.json(cleaned);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching attendance" });
  }
};

/* ================= ADMIN - DAILY SUMMARY ================= */
const getDailySummary = async (req, res) => {
  try {
    const records = await Attendance.find().sort({ timestamp: 1 });
    const summary = {};

    records.forEach((r) => {
      const key = `${r.studentId}_${r.date}`;
      if (!summary[key]) {
        summary[key] = {
          studentId: r.studentId,
          course: r.course,
          date: r.date,
          hasIN: false,
          hasOUT: false,
          totalMs: 0,
          lastIn: null
        };
      }
      
      const time = r.timestamp ? new Date(r.timestamp).getTime() : (r.createdAt ? new Date(r.createdAt).getTime() : 0);

      if (r.type === "IN") {
        summary[key].hasIN = true;
        summary[key].lastIn = time;
      }
      else if (r.type === "OUT") {
        summary[key].hasOUT = true;
        if (summary[key].lastIn) {
            summary[key].totalMs += (time - summary[key].lastIn);
            summary[key].lastIn = null;
        }
      }
    });

    const result = Object.values(summary).map((s) => ({
      studentId: s.studentId,
      course: s.course,
      date: s.date,
      totalHours: (s.totalMs / (1000 * 60 * 60)).toFixed(2),
      status: s.hasIN && s.hasOUT ? "Present" : (s.hasIN || s.hasOUT) ? "Partial" : "Absent",
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN - GET ALL STUDENTS ================= */
const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }, { password: 0 });
    
    const today = new Date().toISOString().split("T")[0];
    const studentIds = students.map(s => s.userId);

    // Bulk query attendance to radically reduce server lag (fixing N+1 bottleneck)
    const todaysLogs = await Attendance.find({ 
      studentId: { $in: studentIds }, 
      date: today 
    }).sort({ createdAt: 1 }); // Sort oldest to newest

    // Build map of the most recent activity type for each student
    const statusMap = {};
    for (const log of todaysLogs) {
       statusMap[log.studentId] = log.type; // since it's sorted 1, the later records overwrite older ones accurately
    }

    const studentData = students.map(s => {
       return {
         ...s.toObject(),
         currentStatus: statusMap[s.userId] === "IN" ? "Inside" : "Outside"
       };
    });

    res.json(studentData);
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN - DELETE STUDENT ================= */
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findOneAndDelete({ userId: id, role: "student" });
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Also clear out their attendance 
    await Attendance.deleteMany({ studentId: id });
    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN - RESET PASSWORD ================= */
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
    let plainPassword = "";
    for (let i = 0; i < 10; i++) plainPassword += chars[Math.floor(Math.random() * chars.length)];
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const updated = await User.findOneAndUpdate(
      { userId: id, role: "student" }, 
      { password: hashedPassword, firstLogin: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Password reset successfully", newPassword: plainPassword });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET PROFILE ================= */
const getProfile = async (req, res) => {
  try {
    const { userId } = req.user || req.query; // If token has userId
    let idToFind = userId;
    if (!idToFind && req.headers.authorization) {
      const token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret");
      idToFind = decoded.userId;
    }
    const user = await User.findOne({ userId: idToFind }, { password: 0 });
    if (!user) return res.status(404).json({ message: "Admin not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  loginAdmin,
  addStudent,
  getAttendance,
  getDailySummary,
  getStudents,
  deleteStudent,
  resetPassword,
  getProfile
};
