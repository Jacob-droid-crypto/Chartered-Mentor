const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
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
      status: s.hasIN && s.hasOUT ? "Present" : (s.hasIN || s.hasOUT) ? "Partial" : "Absent",
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
    const { studentId, qrValue, lat, lng } = req.body;

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

    // --- 1. IP RESTRICTION ---
    const ALLOWED_PUBLIC_IP = "103.182.166.218";
    let requestIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    if (requestIP.includes(",")) {
       requestIP = requestIP.split(",")[0];
    }
    const cleanIP = requestIP.trim().replace("::ffff:", "");
    
    console.log("Debug IP Check:", cleanIP);

    const isIpAllowed = cleanIP === ALLOWED_PUBLIC_IP || cleanIP === "127.0.0.1" || cleanIP === "localhost";

    if (!isIpAllowed) {
      return res.status(403).json({
        message: "Network Error: You must be connected to the Institute's WiFi to mark attendance.",
      });
    }

    // --- 2. GPS RADIUS RESTRICTION ---
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location data is required to verify campus radius." });
    }

    // Set your Institute's exact Latitude and Longitude here:
    // Update these values to the precise GPS coordinates of the institute
    const INST_LAT = 9.9667; 
    const INST_LNG = 76.2667;
    const ALLOWED_RADIUS_METERS = 50000; // Expanded to 50km for testing due to imprecise ISP coordinates
    
    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; 
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180); 
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
                Math.sin(dLon / 2) * Math.sin(dLon / 2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
      return R * c; 
    };

    const distance = getDistance(lat, lng, INST_LAT, INST_LNG);

    if (distance > ALLOWED_RADIUS_METERS) {
       return res.status(403).json({ 
         message: `You are out of campus radius. Distance: ${Math.round(distance)}m` 
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

/* ================= FORGOT PASSWORD ================= */
const forgotPassword = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ userId, role: "student" });
    if (!user) return res.status(404).json({ message: "No student found with that User ID" });
    if (!user.email) return res.status(400).json({ message: "No email associated with this account. Contact Admin." });

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const message = `
      <h1>Password Reset Request</h1>
      <p>Your OTP for password reset is: <strong>${otp}</strong></p>
      <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
    `;

    await transporter.sendMail({
      to: user.email,
      subject: "Chartered Mentor - Password Reset OTP",
      html: message,
    });

    res.json({ message: "OTP sent to your registered email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Error sending email. Check backend configuration." });
  }
};

/* ================= RESET PASSWORD WITH OTP ================= */
const resetPassword = async (req, res) => {
  try {
    const { userId, otp, newPassword } = req.body;

    if (!userId || !otp || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({
      userId,
      role: "student",
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user || !user.resetPasswordOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const isMatch = await bcrypt.compare(otp, user.resetPasswordOtp);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect OTP" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successfully. You can now login." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  loginStudent,
  changePassword,
  getDashboard,
  scanQr,
  getDailyHours,
  updateProfile,
  forgotPassword,
  resetPassword
};
