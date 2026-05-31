const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Attendance = require("../models/Attendance");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
      totalFees: student.totalFees,
      feesPaid: student.feesPaid,
      nextPaymentDueDate: student.nextPaymentDueDate,
      feeHistory: student.feeHistory,
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
    // Read allowed IPs from env (comma-separated list). Fallback to old hardcoded IP.
    const allowedIPsRaw = process.env.ALLOWED_IP || "103.182.166.218";
    const ALLOWED_IPS = allowedIPsRaw.split(",").map(ip => ip.trim()).filter(Boolean);

    let requestIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    if (requestIP.includes(",")) {
       requestIP = requestIP.split(",")[0];
    }
    const cleanIP = requestIP.trim().replace("::ffff:", "");
    
    console.log("Debug IP Check:", cleanIP, "| Allowed:", ALLOWED_IPS);

    let isIpAllowed = 
      ALLOWED_IPS.includes(cleanIP) || 
      cleanIP === "127.0.0.1" || 
      cleanIP === "localhost" ||
      cleanIP.startsWith("192.168.") ||
      cleanIP.startsWith("10.") ||
      cleanIP.startsWith("103.182.166.");

    if (!isIpAllowed) {
      // Also check for 172.16.x.x to 172.31.x.x
      const parts = cleanIP.split(".");
      if (parts.length === 4 && parts[0] === "172") {
        const secondOctet = parseInt(parts[1], 10);
        if (secondOctet >= 16 && secondOctet <= 31) {
          isIpAllowed = true;
        }
      }
    }

    if (!isIpAllowed) {
      return res.status(403).json({
        message: `Network Error: You must be connected to the Institute's WiFi to mark attendance. (Your IP: ${cleanIP})`,
      });
    }

    // --- 2. GPS RADIUS RESTRICTION ---
    if (!lat || !lng) {
      return res.status(400).json({ message: "Location data is required to verify campus radius." });
    }

    // Set your Institute's exact Latitude and Longitude here:
    // Update these values to the precise GPS coordinates of the institute
    const INST_LAT = 9.7760483; 
    const INST_LNG = 76.7631978;
    const ALLOWED_RADIUS_METERS = 50; // Strict 50m radius
    
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
    const { userId, role } = req.body;
    const targetRole = role || "student";
    
    const user = await User.findOne({ userId, role: targetRole });
    if (!user) return res.status(404).json({ message: `No ${targetRole} found with that User ID` });
    if (!user.email) return res.status(400).json({ message: "No email associated with this account. Contact Admin." });

    // Generate a secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    user.resetPasswordOtp = hashedOtp; 
    user.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested to reset your password for your Chartered Mentor account.</p>
        <p>Your One-Time Password (OTP) is:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; padding: 12px 24px; background: #f3f4f6; color: #111827; letter-spacing: 4px; border-radius: 6px; font-weight: bold; font-size: 24px;">${otp}</span>
        </div>
        <p>This code is valid for 15 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888; text-align: center;">Chartered Mentor Support</p>
      </div>
    `;

    let emailSent = false;
    let emailErrorMsg = "";

    // Try Resend first
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Chartered Mentor <onboarding@resend.dev>",
          to: user.email,
          subject: "Chartered Mentor - Password Reset OTP",
          html: message,
        });
        if (error) {
          emailErrorMsg = error.message;
        } else {
          emailSent = true;
        }
      } catch (err) {
        console.error("Resend error:", err);
      }
    }

    // Fallback to Nodemailer
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        await transporter.sendMail({
          from: `"Chartered Mentor" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Chartered Mentor - Password Reset OTP",
          html: message
        });
        emailSent = true;
      } catch (err) {
        emailErrorMsg = err.message;
      }
    }

    if (!emailSent) {
      return res.status(500).json({ message: "Failed to send email. " + emailErrorMsg });
    }

    res.json({ message: "A 6-digit OTP has been sent to your registered email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ================= RESET PASSWORD WITH OTP ================= */
const resetPassword = async (req, res) => {
  try {
    const { userId, otp, newPassword, role } = req.body;
    const targetRole = role || "student";

    if (!userId || !otp || !newPassword) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findOne({
      userId,
      role: targetRole,
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

/* ================= VERIFY GOOGLE OAUTH ================= */
const verifyGoogle = async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ message: "No Google token provided" });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
       return res.status(500).json({ message: "Server is missing GOOGLE_CLIENT_ID. Please tell Admin to configure it." });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const email = payload.email;

    if (!email) {
      return res.status(400).json({ message: "Google authentication failed" });
    }

    const user = await User.findOne({ email, role: "student" });

    if (!user) {
      return res.status(404).json({ message: "No student account found with this Google email. Make sure the Admin used this exact email to create your account." });
    }

    // Google Verified successfully!
    // We return a temporary authentication token so the frontend can immediately hit "Change Password"
    res.json({
      message: "Google Verification Successful",
      userId: user.userId,
      firstLogin: user.firstLogin,
      tempToken: generateToken(user.userId, user.role), // To allow changing password securely
    });

  } catch (error) {
    console.error("Google verify error:", error);
    res.status(500).json({ message: "Invalid or expired Google Token" });
  }
};

const QuestionPaper = require("../models/QuestionPaper");

/* ================= GET STUDENT PAPERS ================= */
const getStudentPapers = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    // The core Time-Gate logic: scheduledTime must be <= current date
    const query = {
      $and: [
        { scheduledTime: { $lte: new Date() } },
        { target: user.userId }
      ]
    };

    const papers = await QuestionPaper.find(query, { fileData: 0 }).sort({ scheduledTime: -1 });

    res.json(papers);
  } catch (err) {
    console.error("Get student papers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DOWNLOAD PAPER ================= */
const downloadPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await QuestionPaper.findById(id);

    if (!paper) {
      return res.status(404).json({ message: "Paper not found" });
    }

    const buffer = Buffer.from(paper.fileData, "base64");

    res.setHeader("Content-Type", paper.fileType);
    res.setHeader("Content-Disposition", `inline; filename="${paper.fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SUBMIT PAYMENT ================= */
const submitPayment = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') return res.status(403).json({ message: "Unauthorized" });

    const { amount, receiptNo } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const studentRecord = await User.findOne({ userId: user.userId, role: 'student' });
    if (!studentRecord) return res.status(404).json({ message: "Student not found" });

    // Add to history as Pending. Do not update feesPaid yet.
    studentRecord.feeHistory.push({
      amount: Number(amount),
      date: new Date(),
      receiptNo: receiptNo || "Self-Reported",
      status: "Pending"
    });

    await studentRecord.save();
    
    res.json({ message: "Payment submitted and is pending admin approval.", feesPaid: studentRecord.feesPaid });
  } catch (err) {
    console.error("Submit payment error:", err);
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
  resetPassword,
  verifyGoogle,
  getStudentPapers,
  downloadPaper,
  submitPayment
};
