const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const PaymentConfig = require("../models/PaymentConfig");
const QuestionPaper = require("../models/QuestionPaper");
const GoalConfig = require("../models/GoalConfig");
const Schedule = require("../models/Schedule");
const ExamSchedule = require("../models/ExamSchedule");
const CampusQR = require("../models/CampusQR");
const { executeAutoLogout } = require("../utils/cronJobs");

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "45d",
  });
};

const getISTDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
};

/* ================= ADMIN LOGIN ================= */
const loginAdmin = async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID is required" });
    const cleanId = userId.trim();

    const admin = await User.findOne({
      $or: [
        { userId: cleanId.toUpperCase() },
        { email: { $regex: new RegExp(`^${cleanId}$`, "i") } }
      ],
      role: { $in: ["admin", "staff"] }
    });
    if (!admin) return res.status(404).json({ message: "Admin/Staff not found" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid password" });

    res.json({
      message: "Login successful",
      firstLogin: admin.firstLogin,
      token: generateToken(admin.userId, admin.role),
      role: admin.role,
      name: admin.name || (admin.role === "admin" ? "Admin" : "Staff"),
    });
  } catch (err) {
    console.error("Login Admin Error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

/* ================= ADD STUDENT ================= */
const addStudent = async (req, res) => {
  try {
    const { name, email, course, mode, batch } = req.body;

    if (!name || !email || !course || !batch) {
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
    const prefix = `${coursePrefix}${year}`;
    
    // Find the student with the highest admission number for this course and year
    const lastStudent = await User.findOne({
      role: "student",
      userId: { $regex: `^${prefix}` }
    }).sort({ userId: -1 });

    let admissionNumber = 101;
    if (lastStudent) {
      const lastNumberStr = lastStudent.userId.replace(prefix, "");
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        admissionNumber = lastNumber + 1;
      }
    }
    const studentId = `${prefix}${admissionNumber}`;

    // Create a temporary unguessable password
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
    let plainPassword = "";
    for (let i = 0; i < 20; i++) plainPassword += chars[Math.floor(Math.random() * chars.length)];
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await User.create({
      userId: studentId,
      name,
      email,
      course,
      mode: mode || "residential",
      batch,
      password: hashedPassword,
      role: "student",
      firstLogin: true,
    });

    // Send Welcome Email with Setup Link
    const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";
    const setupLink = `${frontendURL}/?setup=true&email=${encodeURIComponent(email)}&userId=${studentId}`;

    let emailSent = false;
    let emailErrorMsg = "";

    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4f46e5; text-align: center;">Welcome to Chartered Mentor!</h2>
            <p>Hello ${name},</p>
            <p>Your student account has been created by the administrator. Your Student ID is: <b>${studentId}</b></p>
            <p>Please click the button below to verify your identity with Google and set up your personal password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Set Up Account</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888;">${setupLink}</p>
          </div>
        `;

        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || "Chartered Mentor <onboarding@resend.dev>",
          to: email,
          subject: "Welcome to Chartered Mentor - Account Setup",
          html: message,
        });

        if (error) {
          console.error("Resend API Error:", error);
          emailErrorMsg = error.message;
        } else {
          emailSent = true;
          console.log("Resend success:", data);
        }
      } catch (err) {
        console.error("Resend throw error:", err);
      }
    }

    // Fallback to Nodemailer if Resend failed or wasn't configured
    if (!emailSent && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const message = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #4f46e5; text-align: center;">Welcome to Chartered Mentor!</h2>
            <p>Hello ${name},</p>
            <p>Your student account has been created by the administrator. Your Student ID is: <b>${studentId}</b></p>
            <p>Please click the button below to verify your identity with Google and set up your personal password.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${setupLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Set Up Account</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #888;">${setupLink}</p>
          </div>
        `;

        await transporter.sendMail({
          from: `"Chartered Mentor" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Welcome to Chartered Mentor - Account Setup",
          html: message
        });
        
        emailSent = true;
        console.log("Nodemailer success");
      } catch (err) {
        console.error("Nodemailer error:", err);
        emailErrorMsg = err.message;
      }
    }

    if (!emailSent) {
      console.error("All email methods failed.");
      return res.status(207).json({
        message: "Student added, BUT the setup email failed to send. Please check server logs.",
        userId: studentId,
        error: emailErrorMsg
      });
    }

    res.json({
      message: "Student added and setup email sent successfully!",
      userId: studentId,
    });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN VIEW ATTENDANCE ================= */
const getAttendance = async (req, res) => {
  try {
    const { studentId } = req.query;
    const query = {};
    if (studentId) {
      query.studentId = studentId.trim().toUpperCase();
    }
    const records = await Attendance.find(query).sort({ timestamp: -1 });

    // Fetch names to map to studentName
    const students = await User.find({ role: "student" }, { userId: 1, name: 1 });
    const studentMap = {};
    students.forEach((s) => {
      studentMap[s.userId] = s.name;
    });

    const cleaned = records.map((r) => {
      const d = new Date(r.timestamp);
      return {
        studentId: r.studentId,
        studentName: studentMap[r.studentId] || "Unknown Student",
        course: r.course || "-",
        date: r.date,
        time: isNaN(d.getTime()) ? "-" : d.toLocaleTimeString(),
        type: r.type || "-",
        timestamp: r.timestamp
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
    
    // Fetch names to map to studentName
    const students = await User.find({ role: "student" }, { userId: 1, name: 1 });
    const studentMap = {};
    students.forEach((s) => {
      studentMap[s.userId] = s.name;
    });

    const groupedRecords = {};
    records.forEach((r) => {
      const key = `${r.studentId}_${r.date}`;
      if (!groupedRecords[key]) {
        groupedRecords[key] = [];
      }
      groupedRecords[key].push(r);
    });

    const summary = {};
    for (const key in groupedRecords) {
      const dayLogs = groupedRecords[key];
      const studentId = dayLogs[0].studentId;
      const date = dayLogs[0].date;
      const course = dayLogs[0].course;

      let totalMs = 0;
      let lastInTime = null;
      let firstIn = null;
      const firstInLog = dayLogs.find(log => log.type === "IN");
      if (firstInLog) {
        firstIn = firstInLog.timestamp ? new Date(firstInLog.timestamp).getTime() : (firstInLog.createdAt ? new Date(firstInLog.createdAt).getTime() : 0);
      }

      dayLogs.forEach(log => {
        const logTime = log.timestamp ? new Date(log.timestamp).getTime() : (log.createdAt ? new Date(log.createdAt).getTime() : 0);
        if (log.type === "IN") {
          if (lastInTime === null) {
            lastInTime = logTime;
          }
        } else if (log.type === "OUT") {
          if (lastInTime !== null) {
            totalMs += Math.max(0, logTime - lastInTime);
            lastInTime = null;
          }
        }
      });

      if (lastInTime !== null) {
        const today = getISTDateString();
        if (date === today) {
          totalMs += Math.max(0, Date.now() - lastInTime);
        } else {
          const latestLog = dayLogs[dayLogs.length - 1];
          const latestTime = latestLog.timestamp ? new Date(latestLog.timestamp).getTime() : (latestLog.createdAt ? new Date(latestLog.createdAt).getTime() : 0);
          totalMs += Math.max(0, latestTime - lastInTime);
        }
      }

      summary[key] = {
        studentId,
        studentName: studentMap[studentId] || "Unknown Student",
        course,
        date,
        hasIN: !!firstInLog,
        hasOUT: dayLogs[dayLogs.length - 1].type === "OUT",
        totalMs,
        firstIn
      };
    }

    const result = Object.values(summary).map((s) => ({
      studentId: s.studentId,
      studentName: s.studentName,
      course: s.course,
      date: s.date,
      totalHours: s.totalMs / (1000 * 60 * 60),
      status: s.hasIN ? "Present" : "Absent",
      firstIn: s.firstIn ? new Date(s.firstIn).toISOString() : null,
      hasOUT: s.hasOUT,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= ADMIN - MANUAL CHECK-OUT ================= */
const manualCheckout = async (req, res) => {
  try {
    const { studentId, date, checkoutTime } = req.body;

    if (!studentId || !date || !checkoutTime) {
      return res.status(400).json({ message: "All fields (studentId, date, checkoutTime) are required" });
    }
    const cleanId = studentId.trim().toUpperCase();

    const student = await User.findOne({ userId: cleanId, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if the student has an "IN" record on this date
    const lastInRecord = await Attendance.findOne({ studentId: cleanId, date, type: "IN" }).sort({ createdAt: -1 });
    if (!lastInRecord) {
      return res.status(400).json({ message: "Student must have a Check-In record (IN) on this date to mark Check-OUT manually." });
    }

    // Construct the timestamp for the OUT record in Indian Standard Time (IST, UTC+05:30)
    const timestamp = new Date(`${date}T${checkoutTime}:00+05:30`);
    if (isNaN(timestamp.getTime())) {
      return res.status(400).json({ message: "Invalid date or time format" });
    }

    // Ensure checkout timestamp is after check-in timestamp
    if (timestamp <= new Date(lastInRecord.timestamp)) {
      return res.status(400).json({ message: "Check-out time must be after check-in time." });
    }

    // Look for the latest overall record for this student today
    const lastRecord = await Attendance.findOne({ studentId: cleanId, date }).sort({ createdAt: -1 });

    if (lastRecord && lastRecord.type === "IN") {
      // Create a new OUT record
      await Attendance.create({
        studentId: cleanId,
        course: student.course,
        type: "OUT",
        date,
        timestamp
      });
    } else if (lastRecord && lastRecord.type === "OUT") {
      // Update the latest OUT record's timestamp
      lastRecord.timestamp = timestamp;
      await lastRecord.save();
    }

    res.json({ message: "Check-out time recorded successfully" });
  } catch (err) {
    console.error("Manual Checkout Error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

/* ================= ADMIN - MANUAL CHECK-IN ================= */
const manualCheckin = async (req, res) => {
  try {
    const { studentId, date, checkinTime } = req.body;

    if (!studentId || !date || !checkinTime) {
      return res.status(400).json({ message: "All fields (studentId, date, checkinTime) are required" });
    }
    const cleanId = studentId.trim().toUpperCase();

    const student = await User.findOne({ userId: cleanId, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Construct the timestamp for the IN record in Indian Standard Time (IST, UTC+05:30)
    const timestamp = new Date(`${date}T${checkinTime}:00+05:30`);
    if (isNaN(timestamp.getTime())) {
      return res.status(400).json({ message: "Invalid date or time format" });
    }

    // Look for the latest overall record for this student today
    const lastRecord = await Attendance.findOne({ studentId: cleanId, date }).sort({ createdAt: -1 });

    if (lastRecord && lastRecord.type === "IN") {
      // If the latest record on this date is already IN, update its check-in timestamp
      lastRecord.timestamp = timestamp;
      await lastRecord.save();
    } else {
      // Otherwise, create a new IN record
      await Attendance.create({
        studentId: cleanId,
        course: student.course,
        type: "IN",
        date,
        timestamp
      });
    }

    res.json({ message: "Check-in time recorded successfully" });
  } catch (err) {
    console.error("Manual Checkin Error:", err);
    res.status(500).json({ message: "Server error: " + err.message });
  }
};

/* ================= ADMIN - GET ALL STUDENTS ================= */
const getStudents = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }, { password: 0 });
    
    const today = getISTDateString();
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
       const sObj = s.toObject();
        if (req.user && req.user.role === 'staff') {
          delete sObj.totalFees;
          delete sObj.feesPaid;
          delete sObj.feeHistory;
          if (sObj.installments) {
            sObj.installments = sObj.installments.map(inst => {
              const { amount, adjustedAmount, ...rest } = inst;
              return rest;
            });
          }
        }
       return {
         ...sObj,
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
    if (!id) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = id.trim().toUpperCase();
    const deleted = await User.findOneAndDelete({ userId: cleanId, role: "student" });
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Also clear out their attendance 
    await Attendance.deleteMany({ studentId: cleanId });
    
    // Also clear out their scheduled question papers (base64 storage recovery)
    await QuestionPaper.deleteMany({ target: cleanId });

    // Also clear out their schedules
    await Schedule.deleteMany({ target: cleanId });

    // Also clear out their exam schedules
    await ExamSchedule.deleteMany({ studentId: cleanId });

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
    if (!id) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = id.trim().toUpperCase();
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%";
    let plainPassword = "";
    for (let i = 0; i < 10; i++) plainPassword += chars[Math.floor(Math.random() * chars.length)];
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const updated = await User.findOneAndUpdate(
      { userId: cleanId, role: "student" }, 
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


/* ================= UPLOAD QUESTION PAPER ================= */
const uploadQuestionPaper = async (req, res) => {
  try {
    const { title, target, scheduledTime, examDuration, uploadDuration } = req.body;

    if (!title || !target || !scheduledTime) {
      return res.status(400).json({ message: "Missing fields" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileData = req.file.buffer.toString("base64");
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    const paper = await QuestionPaper.create({
      title,
      target,
      fileName,
      fileType,
      fileData,
      scheduledTime: new Date(scheduledTime),
      examDuration: examDuration ? parseInt(examDuration) : 180,
      uploadDuration: uploadDuration ? parseInt(uploadDuration) : 15,
    });

    res.json({ message: "Question Paper scheduled successfully!" });
  } catch (error) {
    console.error("Upload paper error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ADMIN PAPERS ================= */
const getAdminPapers = async (req, res) => {
  try {
    // Auto-delete question papers 3 days after student started/opened them
    const paperThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await QuestionPaper.deleteMany({ startTime: { $ne: null, $lte: paperThreshold } });

    const papers = await QuestionPaper.find({}, { fileData: 0, answerFileData: 0 }).sort({ scheduledTime: -1 });
    res.json(papers);
  } catch (err) {
    console.error("Get papers error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DELETE PAPER ================= */
const deletePaper = async (req, res) => {
  try {
    const { id } = req.params;
    await QuestionPaper.findByIdAndDelete(id);
    res.json({ message: "Question Paper deleted successfully" });
  } catch (err) {
    console.error("Delete paper error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= DOWNLOAD ANSWER PAPER ================= */
const downloadAnswerPaper = async (req, res) => {
  try {
    const { id } = req.params;
    const paper = await QuestionPaper.findById(id);

    if (!paper) {
      return res.status(404).json({ message: "Question Paper not found" });
    }

    if (!paper.answerFileData) {
      return res.status(404).json({ message: "Answer sheet not submitted yet" });
    }

    const buffer = Buffer.from(paper.answerFileData, "base64");

    res.setHeader("Content-Type", paper.answerFileType || "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${paper.answerFileName || "answer-sheet.pdf"}"`);
    res.send(buffer);
  } catch (err) {
    console.error("Download answer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= PAYMENT CONFIG ================= */
const getPaymentConfig = async (req, res) => {
  try {
    let config = await PaymentConfig.findOne();
    if (!config) {
      config = await PaymentConfig.create({
        accountName: "Institute Name",
        accountNumber: "000000000",
        bankName: "Bank Name",
        ifscCode: "IFSC0000000",
        upiId: "institute@upi"
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const updatePaymentConfig = async (req, res) => {
  try {
    let config = await PaymentConfig.findOne();
    if (config) {
      Object.assign(config, req.body);
      await config.save();
    } else {
      config = await PaymentConfig.create(req.body);
    }
    res.json({ message: "Payment configuration updated", config });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= HELPER FOR INSTALLMENTS ================= */
const updateInstallmentStatus = (user) => {
  if (user.installments && user.installments.length > 0) {
    // Sort chronologically by due date
    user.installments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    // Get all verified/paid/received payments sorted by date
    const payments = (user.feeHistory || [])
      .filter(p => p.status === 'Verified' || p.status === 'Paid' || p.status === 'Received')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Partition payments into linked and unlinked
    const linkedPayments = payments.filter(p => p.installmentNumber && p.installmentNumber > 0);
    const unlinkedPayments = payments.filter(p => !p.installmentNumber || p.installmentNumber <= 0);

    // Initialize all installments to Unpaid
    user.installments.forEach((inst) => {
      inst.status = "Unpaid";
      inst.paidDate = null;
      inst.adjustedAmount = inst.amount;
    });

    // Process explicit linked payments first
    linkedPayments.forEach(p => {
      const idx = p.installmentNumber - 1;
      if (idx >= 0 && idx < user.installments.length) {
        const inst = user.installments[idx];
        inst.status = "Paid";
        inst.paidDate = p.date || new Date();
        inst.adjustedAmount = 0;
      }
    });

    // Sum unlinked payments
    const totalUnlinkedPaid = unlinkedPayments.reduce((sum, p) => sum + p.amount, 0);
    const sumInstallments = user.installments.reduce((sum, inst) => sum + inst.amount, 0);
    const implicitInitialFee = Math.max(0, (user.totalFees || 0) - sumInstallments);

    // Remaining unlinked paid amount after paying initial fee
    let remainingPaid = Math.max(0, totalUnlinkedPaid - implicitInitialFee);

    // Distribute remaining unlinked payments to unpaid installments chronologically
    user.installments.forEach((inst) => {
      if (inst.status === "Paid") {
        // Already paid via explicit linkage
        return;
      }
      if (remainingPaid >= inst.amount) {
        inst.status = "Paid";
        inst.paidDate = unlinkedPayments.length > 0 ? unlinkedPayments[unlinkedPayments.length - 1].date : new Date();
        inst.adjustedAmount = 0;
        remainingPaid -= inst.amount;
      } else {
        inst.status = "Unpaid";
        inst.paidDate = null;
        inst.adjustedAmount = inst.amount - remainingPaid;
        remainingPaid = 0;
      }
    });

    // Sync nextPaymentDueDate to first unpaid installment's dueDate
    const nextUnpaid = user.installments.find(inst => inst.status === "Unpaid");
    user.nextPaymentDueDate = nextUnpaid ? nextUnpaid.dueDate : null;
  }
};

/* ================= STUDENT FEES ================= */
const updateStudentFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { totalFees, installments } = req.body;
    if (!studentId) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = studentId.trim().toUpperCase();
    
    const user = await User.findOne({ userId: cleanId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    user.totalFees = totalFees;
    if (installments && Array.isArray(installments)) {
      user.installments = installments.map(inst => ({
        amount: Number(inst.amount),
        dueDate: new Date(inst.dueDate),
        status: inst.status || "Unpaid",
        paidDate: inst.status === "Paid" ? (inst.paidDate ? new Date(inst.paidDate) : new Date()) : null
      }));
    }
    
    const sumInstallments = user.installments.reduce((sum, inst) => sum + inst.amount, 0);
    const implicitInitialFee = Math.max(0, (user.totalFees || 0) - sumInstallments);
    const sumPaidInstallments = user.installments
      .filter(inst => inst.status === "Paid")
      .reduce((sum, inst) => sum + inst.amount, 0);
    
    const requiredPaid = implicitInitialFee + sumPaidInstallments;
    
    const payments = (user.feeHistory || [])
      .filter(p => p.status === 'Verified' || p.status === 'Paid' || p.status === 'Received');
    const currentVerifiedPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    
    if (currentVerifiedPaid < requiredPaid) {
      const diff = requiredPaid - currentVerifiedPaid;
      const paidInst = user.installments.find(inst => inst.status === "Paid" && inst.paidDate);
      const paymentDate = paidInst ? paidInst.paidDate : new Date();
      
      user.feeHistory.push({
        amount: diff,
        date: paymentDate,
        receiptNo: "Manually Verified (Set Fee Structure)",
        status: "Verified"
      });
      
      user.feesPaid = (user.feesPaid || 0) + diff;
    } else {
      user.feesPaid = user.feeHistory
        .filter(p => p.status === "Verified" || p.status === "Paid" || p.status === "Received")
        .reduce((sum, p) => sum + Number(p.amount), 0);
    }
    
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Student fees updated", user });
  } catch (err) {
    console.error("Update student fees error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const addStudentPayment = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { amount, date, receiptNo } = req.body;
    if (!studentId) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = studentId.trim().toUpperCase();
    
    const user = await User.findOne({ userId: cleanId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    user.feesPaid = (user.feesPaid || 0) + Number(amount);
    user.feeHistory.push({
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      receiptNo,
      status: 'Paid'
    });
    
    // Recalculate installments paid status
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Payment recorded successfully", user });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const approveStudentPayment = async (req, res) => {
  try {
    const { studentId, paymentId } = req.params;
    const { installmentIndex } = req.body;
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    if (payment.status !== "Pending") {
      return res.status(400).json({ message: "Payment is already processed" });
    }
    
    payment.status = "Verified";
    user.feesPaid = (user.feesPaid || 0) + Number(payment.amount);
    
    if (installmentIndex !== undefined && installmentIndex !== null && user.installments[installmentIndex]) {
      user.installments[installmentIndex].status = "Paid";
      user.installments[installmentIndex].paidDate = payment.date || new Date();
      payment.installmentNumber = Number(installmentIndex) + 1;
    }
    
    // Recalculate installments paid status
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Payment approved and ledger updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const rejectStudentPayment = async (req, res) => {
  try {
    const { studentId, paymentId } = req.params;
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    // Revert balance if payment was already approved or recorded as paid
    if (payment.status === "Verified" || payment.status === "Paid" || payment.status === "Received") {
      user.feesPaid = Math.max(0, (user.feesPaid || 0) - Number(payment.amount));
    }
    
    payment.status = "Rejected";
    
    // Recalculate installments paid status
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Payment rejected and ledger updated", user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const editStudentPayment = async (req, res) => {
  try {
    const { studentId, paymentId } = req.params;
    const { amount, date, status, receiptNo, installmentNumber } = req.body;
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    if (amount !== undefined) payment.amount = Number(amount);
    if (date !== undefined) payment.date = new Date(date);
    if (status !== undefined) payment.status = status;
    if (receiptNo !== undefined) payment.receiptNo = receiptNo;
    if (installmentNumber !== undefined) {
      payment.installmentNumber = installmentNumber ? Number(installmentNumber) : null;
    }
    
    // Recalculate total feesPaid from all Verified, Paid, or Received payments
    user.feesPaid = user.feeHistory
      .filter(p => p.status === "Verified" || p.status === "Paid" || p.status === "Received")
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    // Recalculate installments paid status
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Payment updated successfully", user });
  } catch (err) {
    console.error("Edit student payment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const revertStudentPayment = async (req, res) => {
  try {
    const { studentId, paymentId } = req.params;
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    payment.status = "Pending";
    
    // Recalculate total feesPaid from all Verified, Paid, or Received payments
    user.feesPaid = user.feeHistory
      .filter(p => p.status === "Verified" || p.status === "Paid" || p.status === "Received")
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    // Recalculate installments paid status
    updateInstallmentStatus(user);
    
    await user.save();
    res.json({ message: "Payment reverted to pending (unmarked) successfully", user });
  } catch (err) {
    console.error("Revert student payment error:", err);
    res.status(500).json({ message: "Server error" });
  }
};



const updateStudentProfileByAdmin = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = studentId.trim().toUpperCase();
    const student = await User.findOne({ userId: cleanId, role: "student" });
    if (!student) return res.status(404).json({ message: "Student not found" });

    const {
      name, email, phone, course, mode, batch, group, aadharNumber, dob, joiningDate,
      address, fatherName, fatherPhone, fatherOccupation, motherName, motherPhone, motherOccupation,
      seatNumber
    } = req.body;

    if (name !== undefined) student.name = name;
    if (email !== undefined) student.email = email;
    if (phone !== undefined) student.phone = phone;
    if (course !== undefined) student.course = course;
    if (mode !== undefined) student.mode = mode;
    if (batch !== undefined) student.batch = batch;
    if (group !== undefined) student.group = group;
    if (aadharNumber !== undefined) student.aadharNumber = aadharNumber;
    if (dob !== undefined) student.dob = dob ? new Date(dob) : null;
    if (joiningDate !== undefined) student.joiningDate = joiningDate ? new Date(joiningDate) : null;
    if (address !== undefined) student.address = address;
    if (fatherName !== undefined) student.fatherName = fatherName;
    if (fatherPhone !== undefined) student.fatherPhone = fatherPhone;
    if (fatherOccupation !== undefined) student.fatherOccupation = fatherOccupation;
    if (motherName !== undefined) student.motherName = motherName;
    if (motherPhone !== undefined) student.motherPhone = motherPhone;
    if (motherOccupation !== undefined) student.motherOccupation = motherOccupation;
    if (seatNumber !== undefined) student.seatNumber = seatNumber || null;

    // Check if profile is complete (all required fields filled)
    if (
      student.name &&
      student.email &&
      student.phone &&
      student.address &&
      student.group &&
      student.aadharNumber &&
      student.dob &&
      student.joiningDate &&
      student.fatherName &&
      student.fatherPhone &&
      student.fatherOccupation &&
      student.motherName &&
      student.motherPhone &&
      student.motherOccupation
    ) {
      student.profileCompleted = true;
    } else {
      student.profileCompleted = false;
    }

    await student.save();

    const sObj = student.toObject();
    if (req.user && req.user.role === 'staff') {
      delete sObj.totalFees;
      delete sObj.feesPaid;
      delete sObj.feeHistory;
      delete sObj.installments;
      delete sObj.nextPaymentDueDate;
    }
    
    res.json({ message: "Student profile updated successfully", student: sObj });
  } catch (err) {
    console.error("Update student profile by admin error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GOAL TARGET CONFIGURATION ================= */
const getGoalConfig = async (req, res) => {
  try {
    let configs = await GoalConfig.find({});
    if (configs.length === 0) {
      const initial = await GoalConfig.create({
        studentId: null,
        effectiveFrom: "1970-01-01",
        monday: 12,
        tuesday: 12,
        wednesday: 12,
        thursday: 12,
        friday: 12,
        saturday: 12,
        sunday: 0,
        autoLogoutTime: "22:00",
        autoLogoutEnabled: true
      });
      configs = [initial];
    }

    const todayStr = getISTDateString();

    // If request is from a student, resolve their active goal config
    let activeConfig = null;
    if (req.user && req.user.role === 'student') {
      const studentId = req.user.userId;
      const studentConfigs = configs.filter(c => c.studentId === studentId);
      studentConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      activeConfig = studentConfigs.find(c => c.effectiveFrom <= todayStr);
    }

    // Fallback/Default lookup if student check is false or doesn't match
    if (!activeConfig) {
      const defaultConfigs = configs.filter(c => !c.studentId);
      defaultConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
      activeConfig = defaultConfigs.find(c => c.effectiveFrom <= todayStr) || defaultConfigs[defaultConfigs.length - 1];
    }

    let filteredConfigs = configs;
    if (req.user && req.user.role === 'student') {
      filteredConfigs = configs.filter(c => !c.studentId || c.studentId === req.user.userId);
    }

    res.json({
      active: activeConfig,
      configs: filteredConfigs
    });
  } catch (err) {
    console.error("Get goal config error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateGoalConfig = async (req, res) => {
  try {
    const {
      studentId,
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
      autoLogoutEnabled,
      autoLogoutTime
    } = req.body;

    const todayStr = getISTDateString();
    const cleanStudentId = studentId ? studentId.trim().toUpperCase() : null;

    // Find if a config exists for this student/default on the same effective date (today)
    let config = await GoalConfig.findOne({ studentId: cleanStudentId, effectiveFrom: todayStr });

    const updateData = {
      monday: monday !== undefined ? Number(monday) : 12,
      tuesday: tuesday !== undefined ? Number(tuesday) : 12,
      wednesday: wednesday !== undefined ? Number(wednesday) : 12,
      thursday: thursday !== undefined ? Number(thursday) : 12,
      friday: friday !== undefined ? Number(friday) : 12,
      saturday: saturday !== undefined ? Number(saturday) : 12,
      sunday: sunday !== undefined ? Number(sunday) : 0
    };

    // Auto-logout is global and set only on global configs (where studentId is null)
    if (!cleanStudentId) {
      if (autoLogoutEnabled !== undefined) updateData.autoLogoutEnabled = autoLogoutEnabled;
      if (autoLogoutTime !== undefined) updateData.autoLogoutTime = autoLogoutTime;
    }

    if (config) {
      Object.assign(config, updateData);
      await config.save();
    } else {
      config = await GoalConfig.create({
        studentId: cleanStudentId,
        effectiveFrom: todayStr,
        ...updateData
      });
    }

    res.json({ message: "Goal configuration saved successfully", config });
  } catch (err) {
    console.error("Update goal config error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteGoalConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await GoalConfig.findById(id);
    if (!config) {
      return res.status(404).json({ message: "Goal configuration not found" });
    }

    // Protect the fallback config
    if (!config.studentId && config.effectiveFrom === "1970-01-01") {
      return res.status(400).json({ message: "Cannot delete the initial default goal configuration" });
    }

    await GoalConfig.findByIdAndDelete(id);
    res.json({ message: "Goal configuration deleted successfully" });
  } catch (err) {
    console.error("Delete goal config error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= SCHEDULES ================= */
const createSchedule = async (req, res) => {
  try {
    const { title, target, date } = req.body;

    if (!title || !target || !date) {
      return res.status(400).json({ message: "Heading, target student, and date are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Schedule PDF file is required." });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ message: "Only PDF files are allowed for schedules." });
    }

    const fileData = req.file.buffer.toString("base64");
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    const schedule = await Schedule.create({
      title,
      description: "",
      target,
      date: new Date(date),
      startTime: "",
      endTime: "",
      status: "Pending",
      fileName,
      fileType,
      fileData,
      googleSheetUrl: null,
      openedAt: null
    });

    res.status(201).json({ message: "Schedule created successfully", schedule });
  } catch (error) {
    console.error("Create schedule error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getAdminSchedules = async (req, res) => {
  try {
    // Auto-delete schedules 10 days after they were opened
    const threshold = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await Schedule.deleteMany({ openedAt: { $ne: null, $lte: threshold } });

    const schedules = await Schedule.find({}, { fileData: 0 }).sort({ date: 1 });
    res.json(schedules);
  } catch (error) {
    console.error("Get admin schedules error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Schedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Schedule not found" });
    }
    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const downloadScheduleFileAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const schedule = await Schedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    if (!schedule.fileData) {
      return res.status(404).json({ message: "No file associated with this schedule" });
    }

    const buffer = Buffer.from(schedule.fileData, "base64");
    res.setHeader("Content-Type", schedule.fileType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${schedule.fileName || "schedule-file"}"`);
    res.send(buffer);
  } catch (error) {
    console.error("Download schedule file admin error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= EXAM SCHEDULER ================= */
const getExamSchedules = async (req, res) => {
  try {
    const schedules = await ExamSchedule.find({}).sort({ date: 1 });
    res.json(schedules);
  } catch (err) {
    console.error("Get exam schedules error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const createExamSchedule = async (req, res) => {
  try {
    const { studentId, type, date, examName } = req.body;
    if (!studentId || !type || !date) {
      return res.status(400).json({ message: "Student Name, Type, and Date are required" });
    }
    const cleanId = studentId.trim().toUpperCase();

    const student = await User.findOne({ userId: cleanId, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const schedule = await ExamSchedule.create({
      studentId,
      studentName: student.name,
      type,
      date: new Date(date),
      examName: type === "Exam" ? examName : "",
    });

    res.status(201).json({ message: "Exam/Schedule scheduled successfully", schedule });
  } catch (err) {
    console.error("Create exam schedule error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateExamSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, examName } = req.body;

    const schedule = await ExamSchedule.findById(id);
    if (!schedule) {
      return res.status(404).json({ message: "Exam/Schedule not found" });
    }

    if (date !== undefined) schedule.date = new Date(date);
    if (examName !== undefined) schedule.examName = schedule.type === "Exam" ? examName : "";

    await schedule.save();
    res.json({ message: "Exam/Schedule updated successfully", schedule });
  } catch (err) {
    console.error("Update exam schedule error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteExamSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ExamSchedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Exam/Schedule not found" });
    }
    res.json({ message: "Exam/Schedule deleted successfully" });
  } catch (err) {
    console.error("Delete exam schedule error:", err);
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
  getProfile,
  uploadQuestionPaper,
  getAdminPapers,
  deletePaper,
  downloadAnswerPaper,
  getPaymentConfig,
  updatePaymentConfig,
  updateStudentFees,
  addStudentPayment,
  approveStudentPayment,
  rejectStudentPayment,
  editStudentPayment,
  revertStudentPayment,
  updateStudentProfileByAdmin,
  getGoalConfig,
  updateGoalConfig,
  createSchedule,
  getAdminSchedules,
  deleteSchedule,
  manualCheckout,
  downloadScheduleFileAdmin,
  getExamSchedules,
  createExamSchedule,
  updateExamSchedule,
  deleteExamSchedule
};

const getCampusQR = async (req, res) => {
  try {
    let config = await CampusQR.findOne();
    if (!config) {
      config = await CampusQR.create({
        activeInToken: "CM-ATTENDANCE-IN",
        activeOutToken: "CM-ATTENDANCE-OUT"
      });
    }
    res.json(config);
  } catch (err) {
    console.error("Get campus QR error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const refreshCampusQR = async (req, res) => {
  try {
    const { type } = req.body; // 'IN' or 'OUT'
    if (type !== 'IN' && type !== 'OUT') {
      return res.status(400).json({ message: "Invalid type" });
    }

    let config = await CampusQR.findOne();
    if (!config) {
      config = new CampusQR();
    }

    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (type === 'IN') {
      config.activeInToken = `CM-ATTENDANCE-IN-${randomSuffix}`;
    } else {
      config.activeOutToken = `CM-ATTENDANCE-OUT-${randomSuffix}`;
    }
    config.updatedAt = new Date();

    await config.save();
    res.json(config);
  } catch (err) {
    console.error("Refresh campus QR error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const resetStudentDevice = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Student ID is required" });
    const cleanId = id.trim().toUpperCase();
    const updated = await User.findOneAndUpdate(
      { userId: cleanId, role: "student" },
      { deviceFingerprint: null },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Student device lock reset successfully" });
  } catch (err) {
    console.error("Reset device error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= TRIGGER AUTO LOGOUT ================= */
const triggerAutoLogout = async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && (!authHeader || authHeader !== `Bearer ${cronSecret}`)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const stats = await executeAutoLogout();
    res.json({ message: "Auto logout cron job completed", stats });
  } catch (err) {
    console.error("Cron route error:", err);
    res.status(500).json({ message: "Cron job failed: " + err.message });
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
  getProfile,
  uploadQuestionPaper,
  getAdminPapers,
  deletePaper,
  downloadAnswerPaper,
  getPaymentConfig,
  updatePaymentConfig,
  updateStudentFees,
  addStudentPayment,
  approveStudentPayment,
  rejectStudentPayment,
  editStudentPayment,
  revertStudentPayment,
  updateStudentProfileByAdmin,
  getGoalConfig,
  updateGoalConfig,
  deleteGoalConfig,
  createSchedule,
  getAdminSchedules,
  deleteSchedule,
  manualCheckout,
  manualCheckin,
  downloadScheduleFileAdmin,
  getExamSchedules,
  createExamSchedule,
  updateExamSchedule,
  deleteExamSchedule,
  getCampusQR,
  refreshCampusQR,
  resetStudentDevice,
  triggerAutoLogout
};
