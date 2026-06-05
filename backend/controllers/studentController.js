const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Schedule = require("../models/Schedule");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
  });
};

const getISTDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
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
      profileCompleted: student.profileCompleted || false,
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

    const today = getISTDateString();

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
      mode: student.mode || "residential",
      profilePhoto: student.profilePhoto,
      totalFees: student.totalFees,
      feesPaid: student.feesPaid,
      nextPaymentDueDate: student.nextPaymentDueDate,
      feeHistory: student.feeHistory,
      todayLogs: logs,
      attendanceSummary,
      address: student.address || "",
      group: student.group || "",
      aadharNumber: student.aadharNumber || "",
      fatherName: student.fatherName || "",
      fatherPhone: student.fatherPhone || "",
      fatherOccupation: student.fatherOccupation || "",
      motherName: student.motherName || "",
      motherPhone: student.motherPhone || "",
      motherOccupation: student.motherOccupation || "",
      profileCompleted: student.profileCompleted || false,
      batch: student.batch || "",
      dob: student.dob || null,
      joiningDate: student.joiningDate || null
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
    // Read allowed IPs from env (comma-separated list). Fallback to new hardcoded IP.
    const allowedIPsRaw = process.env.ALLOWED_IP || "192.168.68.120, 111.92.83.195";
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
      cleanIP.startsWith("10.");

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
    const INST_LAT = 9.99232; 
    const INST_LNG = 76.31317;
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
    const today = getISTDateString();

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
    
    const { 
      name, email, phone, course, profilePhoto,
      address, group, aadharNumber, dob, joiningDate,
      fatherName, fatherPhone, fatherOccupation,
      motherName, motherPhone, motherOccupation
    } = req.body;

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (course !== undefined) user.course = course;
    if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;

    if (address !== undefined) user.address = address;
    if (group !== undefined) user.group = group;
    if (aadharNumber !== undefined) user.aadharNumber = aadharNumber;
    if (dob !== undefined) user.dob = dob;
    if (joiningDate !== undefined) user.joiningDate = joiningDate;
    if (fatherName !== undefined) user.fatherName = fatherName;
    if (fatherPhone !== undefined) user.fatherPhone = fatherPhone;
    if (fatherOccupation !== undefined) user.fatherOccupation = fatherOccupation;
    if (motherName !== undefined) user.motherName = motherName;
    if (motherPhone !== undefined) user.motherPhone = motherPhone;
    if (motherOccupation !== undefined) user.motherOccupation = motherOccupation;

    // Check if profile is complete (all required fields filled)
    if (
      user.name && 
      user.email && 
      user.phone && 
      user.address && 
      user.group && 
      user.aadharNumber && 
      user.dob &&
      user.joiningDate &&
      user.fatherName && 
      user.fatherPhone && 
      user.fatherOccupation && 
      user.motherName && 
      user.motherPhone && 
      user.motherOccupation
    ) {
      user.profileCompleted = true;
    } else {
      user.profileCompleted = false;
    }

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

    const query = { target: user.userId };

    const papers = await QuestionPaper.find(query, { fileData: 0, answerFileData: 0 }).sort({ scheduledTime: 1 });

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

/* ================= MANUAL ATTENDANCE ================= */
const manualAttendance = async (req, res) => {
  try {
    const { studentId, action } = req.body; // action is 'IN' or 'OUT'

    if (!studentId || !action || !["IN", "OUT"].includes(action)) {
      return res.status(400).json({ message: "Invalid action or missing data" });
    }

    const student = await User.findOne({
      userId: studentId,
      role: "student",
    });

    if (!student) {
      return res.status(401).json({ message: "Invalid student session." });
    }

    if (student.mode !== "online") {
      return res.status(403).json({ message: "Manual attendance is only allowed for online students." });
    }

    const today = getISTDateString();

    // Get today's logs to validate logic
    const logs = await Attendance.find({ studentId, date: today }).sort({ createdAt: 1 });
    
    // Determine current state based on last log
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
    
    if (action === "IN") {
      if (lastLog && lastLog.type === "IN") {
        return res.status(400).json({ message: "You are already checked IN." });
      }
    } else if (action === "OUT") {
      if (!lastLog || lastLog.type === "OUT") {
        return res.status(400).json({ message: "You must check IN before checking OUT." });
      }
    }

    const newLog = await Attendance.create({
      studentId: studentId,
      course: student.course,
      type: action,
      date: today,
    });

    res.json({
      message: `Successfully checked ${action}`,
      type: action,
      timestamp: newLog.timestamp,
    });
  } catch (err) {
    console.error("Manual Attendance Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= START STUDENT EXAM ================= */
const startStudentExam = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const paper = await QuestionPaper.findOne({ _id: id, target: user.userId });
    if (!paper) {
      return res.status(404).json({ message: "Paper not found" });
    }

    // Date comparison (midnight local time or date string splitting)
    const todayStr = getISTDateString();
    const scheduledStr = new Date(paper.scheduledTime).toISOString().split("T")[0];

    // If today is before the scheduled date, it's locked
    if (todayStr < scheduledStr) {
      return res.status(400).json({ message: "Exam is locked until the scheduled date" });
    }

    // Set startTime if not already started
    if (!paper.startTime) {
      paper.startTime = new Date();
      await paper.save();
    }

    res.json({
      message: "Exam started successfully",
      startTime: paper.startTime,
      examDuration: paper.examDuration,
      uploadDuration: paper.uploadDuration,
    });
  } catch (err) {
    console.error("Start exam error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SUBMIT ANSWER PAPER ================= */
const submitAnswerPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const { answerFileName, answerFileType, answerFileData } = req.body;

    if (!answerFileName || !answerFileType || !answerFileData) {
      return res.status(400).json({ message: "Missing file details" });
    }

    const paper = await QuestionPaper.findOne({ _id: id, target: user.userId });
    if (!paper) {
      return res.status(404).json({ message: "Paper not found" });
    }

    if (!paper.startTime) {
      paper.startTime = new Date();
    }

    // Enforce combined exam + upload duration timer
    const totalDurationMs = (paper.examDuration + paper.uploadDuration) * 60 * 1000;
    const startMs = new Date(paper.startTime).getTime();
    const currentMs = new Date().getTime();

    // 2-minute buffer for network lag
    if (currentMs - startMs > totalDurationMs + 120000) {
      return res.status(400).json({ message: "Time Expired. Answer sheets cannot be submitted." });
    }

    paper.answerFileName = answerFileName;
    paper.answerFileType = answerFileType;
    paper.answerFileData = answerFileData;
    paper.answerUploadedAt = new Date();
    await paper.save();

    res.json({
      message: "Answer sheets submitted successfully",
      answerUploadedAt: paper.answerUploadedAt,
      answerFileName: paper.answerFileName,
    });
  } catch (err) {
    console.error("Submit answer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= STUDENT VIEW ANSWER SHEET ================= */
const downloadStudentAnswerPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const paper = await QuestionPaper.findOne({ _id: id, target: user.userId });

    if (!paper) {
      return res.status(404).json({ message: "Paper not found" });
    }

    if (!paper.answerFileData) {
      return res.status(404).json({ message: "Answer sheet not submitted yet" });
    }

    const buffer = Buffer.from(paper.answerFileData, "base64");

    res.setHeader("Content-Type", paper.answerFileType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${paper.answerFileName || "answer-sheet.pdf"}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Download student answer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= STUDENT SCHEDULES ================= */
const getStudentSchedules = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const threshold = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await Schedule.deleteMany({ openedAt: { $ne: null, $lte: threshold } });

    const schedules = await Schedule.find({ target: user.userId }, { fileData: 0 }).sort({ date: 1 });
    res.json(schedules);
  } catch (error) {
    console.error("Get student schedules error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const toggleScheduleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const schedule = await Schedule.findOne({ _id: id, target: user.userId });
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found or unauthorized" });
    }

    schedule.status = schedule.status === "Pending" ? "Completed" : "Pending";
    await schedule.save();

    res.json({ message: `Schedule marked as ${schedule.status}`, schedule });
  } catch (error) {
    console.error("Toggle schedule status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const downloadScheduleFile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });

    const schedule = await Schedule.findOne({ _id: id, target: user.userId });
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found or unauthorized" });
    }

    if (!schedule.fileData) {
      return res.status(404).json({ message: "No file associated with this schedule" });
    }

    // Set openedAt if not already marked
    if (!schedule.openedAt) {
      schedule.openedAt = new Date();
      await schedule.save();
    }

    const buffer = Buffer.from(schedule.fileData, "base64");
    res.setHeader("Content-Type", schedule.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${schedule.fileName || "schedule-file"}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Download schedule file error:", error);
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
  startStudentExam,
  submitAnswerPaper,
  downloadStudentAnswerPaper,
  submitPayment,
  manualAttendance,
  getStudentSchedules,
  toggleScheduleStatus,
  downloadScheduleFile
};
