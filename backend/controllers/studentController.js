const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
  });
};

/* ================= STUDENT LOGIN ================= */
const loginStudent = async (req, res) => {
  try {
    const { userId, password } = req.body;

    const student = await User.findOne({ userId, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      studentId: student.userId,
      name: student.name,
      firstLogin: student.firstLogin,
      token: generateToken(student.userId, student.role),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= CHANGE STUDENT PASSWORD ================= */
const changePassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ message: "Missing data" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.updateOne(
      { userId, role: "student" },
      { password: hashedPassword, firstLogin: false },
    );

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DASHBOARD INFO ================= */
const getDashboard = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne(
      { userId: studentId, role: "student" },
      { password: 0 },
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const today = new Date().toISOString().split("T")[0];

    const logs = await Attendance.find({
      studentId,
      date: today,
    }).sort({ createdAt: 1 });

    const allLogs = await Attendance.find({ studentId }).sort({ timestamp: 1 });
    const summary = {};
    allLogs.forEach((r) => {
      const key = r.date;
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
      } else if (r.type === "OUT") {
        summary[key].hasOUT = true;
        if (summary[key].lastIn) {
            summary[key].totalMs += (time - summary[key].lastIn);
            summary[key].lastIn = null;
        }
      }
    });

    const attendanceSummary = Object.values(summary).map((s) => ({
      studentId: s.studentId,
      course: s.course,
      date: s.date,
      totalHours: (s.totalMs / (1000 * 60 * 60)).toFixed(2),
      status: s.hasIN && s.hasOUT ? "Present" : s.hasIN ? "Partial" : "Absent",
    }));

    res.json({
      studentId: student.userId,
      name: student.name,
      email: student.email,
      phone: student.phone,
      course: student.course,
      profilePhoto: student.profilePhoto,
      todayLogs: logs,
      attendanceSummary
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= MARK ATTENDANCE ================= */
const scanQr = async (req, res) => {
  try {
    const { studentId, qrValue } = req.body;

    if (!studentId || !qrValue) {
      return res.status(400).json({ message: "Missing data" });
    }

    const student = await User.findOne({
      userId: studentId,
      role: "student",
    });

    if (!student) {
      return res.status(401).json({
        message: "Invalid student session. Please login again.",
      });
    }

    const ALLOWED_PUBLIC_IP = "103.182.166.212";
    const requestIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const cleanIP = requestIP.replace("::ffff:", "");
    
    console.log("Debug IP Check:", cleanIP);

    const isAllowed = true; // Bypassed for local development testing

    if (!isAllowed) {
      return res.status(403).json({
        message: "Attendance allowed only inside institution network",
      });
    }

    let type;
    if (qrValue === "CM-ATTENDANCE-IN") type = "IN";
    else if (qrValue === "CM-ATTENDANCE-OUT") type = "OUT";
    else return res.status(401).json({ message: "Invalid QR code" });

    const course = studentId.substring(2, 5);
    const today = new Date().toISOString().split("T")[0];

    const lastRecord = await Attendance.findOne({ studentId, date: today }).sort({ createdAt: -1 });

    if (type === "IN") {
      if (lastRecord && lastRecord.type === "IN") {
        return res.status(400).json({ message: "You are already Checked IN!" });
      }
    } else if (type === "OUT") {
      if (!lastRecord || lastRecord.type === "OUT") {
        return res.status(400).json({ message: "You must Check IN first before Checking OUT!" });
      }
    }

    await Attendance.create({
      studentId,
      course,
      type,
      date: today
    });

    res.json({ message: `Attendance ${type} marked successfully` });
  } catch (error) {
    console.error("QR scan error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DAILY HOURS CALCULATION ================= */
const getDailyHours = async (req, res) => {
  try {
    const { studentId, date } = req.params;

    const logs = await Attendance.find({ studentId, date }).sort({
      createdAt: 1,
    });

    let totalMs = 0;
    let lastIn = null;

    for (const log of logs) {
      if (log.type === "IN") {
        lastIn = log.createdAt;
      } else if (log.type === "OUT" && lastIn) {
        totalMs += log.createdAt - lastIn;
        lastIn = null;
      }
    }

    const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(2);

    res.json({
      studentId,
      date,
      totalHours,
    });
  } catch (err) {
    console.error("Hour calculation error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= UPDATE PROFILE ================= */
const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });
    
    const { name, email, phone, course, profilePhoto } = req.body;

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (course) user.course = course;
    if (profilePhoto) user.profilePhoto = profilePhoto;

    await user.save();
    
    res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  loginStudent,
  changePassword,
  getDashboard,
  scanQr,
  getDailyHours,
  updateProfile
};
