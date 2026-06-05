const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const PaymentConfig = require("../models/PaymentConfig");
const QuestionPaper = require("../models/QuestionPaper");
const GoalConfig = require("../models/GoalConfig");
const Schedule = require("../models/Schedule");

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "30d",
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

    const admin = await User.findOne({ userId, role: { $in: ["admin", "staff"] } });
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
    const records = await Attendance.find().sort({ timestamp: -1 });

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

    const summary = {};

    records.forEach((r) => {
      const key = `${r.studentId}_${r.date}`;
      if (!summary[key]) {
        summary[key] = {
          studentId: r.studentId,
          studentName: studentMap[r.studentId] || "Unknown Student",
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
      studentName: s.studentName,
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

/* ================= ADMIN - MANUAL CHECK-OUT ================= */
const manualCheckout = async (req, res) => {
  try {
    const { studentId, date, checkoutTime } = req.body;

    if (!studentId || !date || !checkoutTime) {
      return res.status(400).json({ message: "All fields (studentId, date, checkoutTime) are required" });
    }

    const student = await User.findOne({ userId: studentId, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if the student has an "IN" record on this date
    const inRecord = await Attendance.findOne({ studentId, date, type: "IN" });
    if (!inRecord) {
      return res.status(400).json({ message: "Student must have a Check-In record (IN) on this date to mark Check-OUT manually." });
    }

    // Construct the timestamp for the OUT record in Indian Standard Time (IST, UTC+05:30)
    const timestamp = new Date(`${date}T${checkoutTime}:00+05:30`);
    if (isNaN(timestamp.getTime())) {
      return res.status(400).json({ message: "Invalid date or time format" });
    }

    // Ensure checkout timestamp is after check-in timestamp
    if (timestamp <= new Date(inRecord.timestamp)) {
      return res.status(400).json({ message: "Check-out time must be after check-in time." });
    }

    // Look for an existing "OUT" record
    let outRecord = await Attendance.findOne({ studentId, date, type: "OUT" });
    if (outRecord) {
      outRecord.timestamp = timestamp;
      await outRecord.save();
    } else {
      await Attendance.create({
        studentId,
        course: student.course,
        type: "OUT",
        date,
        timestamp
      });
    }

    res.json({ message: "Check-out time recorded successfully" });
  } catch (err) {
    console.error("Manual Checkout Error:", err);
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
         delete sObj.installments;
         delete sObj.nextPaymentDueDate;
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
    const deleted = await User.findOneAndDelete({ userId: id, role: "student" });
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Also clear out their attendance 
    await Attendance.deleteMany({ studentId: id });
    
    // Also clear out their scheduled question papers (base64 storage recovery)
    await QuestionPaper.deleteMany({ target: id });

    // Also clear out their schedules
    await Schedule.deleteMany({ target: id });

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

    res.json({ message: "Paper scheduled successfully!" });
  } catch (error) {
    console.error("Upload paper error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ADMIN PAPERS ================= */
const getAdminPapers = async (req, res) => {
  try {
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
    res.json({ message: "Paper deleted successfully" });
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
      return res.status(404).json({ message: "Paper not found" });
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

    // Get all verified/paid payments sorted by date
    const payments = (user.feeHistory || [])
      .filter(p => p.status === 'Verified' || p.status === 'Paid')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let paymentIdx = 0;
    let paymentRemaining = payments[paymentIdx] ? payments[paymentIdx].amount : 0;

    user.installments.forEach((inst) => {
      let instNeeded = inst.amount;
      let lastPaymentDate = null;

      while (instNeeded > 0 && paymentIdx < payments.length) {
        if (paymentRemaining >= instNeeded) {
          paymentRemaining -= instNeeded;
          instNeeded = 0;
          lastPaymentDate = payments[paymentIdx].date;
        } else {
          instNeeded -= paymentRemaining;
          paymentIdx++;
          paymentRemaining = payments[paymentIdx] ? payments[paymentIdx].amount : 0;
        }
      }

      if (instNeeded === 0) {
        inst.status = "Paid";
        inst.paidDate = lastPaymentDate || new Date();
      } else {
        inst.status = "Unpaid";
        inst.paidDate = null;
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
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    user.totalFees = totalFees;
    if (installments && Array.isArray(installments)) {
      user.installments = installments.map(inst => ({
        amount: Number(inst.amount),
        dueDate: new Date(inst.dueDate),
        status: inst.status || "Unpaid"
      }));
    }
    
    // Automatically allocate existing paid fees to installments
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
    
    const user = await User.findOne({ userId: studentId, role: "student" });
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
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    if (payment.status !== "Pending") {
      return res.status(400).json({ message: "Payment is already processed" });
    }
    
    payment.status = "Verified";
    user.feesPaid = (user.feesPaid || 0) + Number(payment.amount);
    
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
    if (payment.status === "Verified" || payment.status === "Paid") {
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
    const { amount, date, status, receiptNo } = req.body;
    
    const user = await User.findOne({ userId: studentId, role: "student" });
    if (!user) return res.status(404).json({ message: "Student not found" });
    
    const payment = user.feeHistory.id(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment record not found" });
    
    if (amount !== undefined) payment.amount = Number(amount);
    if (date !== undefined) payment.date = new Date(date);
    if (status !== undefined) payment.status = status;
    if (receiptNo !== undefined) payment.receiptNo = receiptNo;
    
    // Recalculate total feesPaid from all Verified or Paid payments
    user.feesPaid = user.feeHistory
      .filter(p => p.status === "Verified" || p.status === "Paid")
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
    
    // Recalculate total feesPaid from all Verified or Paid payments
    user.feesPaid = user.feeHistory
      .filter(p => p.status === "Verified" || p.status === "Paid")
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
    const { joiningDate } = req.body;
    
    const student = await User.findOneAndUpdate(
      { userId: studentId, role: "student" },
      { joiningDate },
      { new: true }
    );
    
    if (!student) return res.status(404).json({ message: "Student not found" });

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
    let config = await GoalConfig.findOne();
    if (!config) {
      config = await GoalConfig.create({
        monday: 12,
        tuesday: 12,
        wednesday: 12,
        thursday: 12,
        friday: 12,
        saturday: 12,
        sunday: 0
      });
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const updateGoalConfig = async (req, res) => {
  try {
    let config = await GoalConfig.findOne();
    if (config) {
      Object.assign(config, req.body);
      await config.save();
    } else {
      config = await GoalConfig.create(req.body);
    }
    res.json({ message: "Goal configuration updated", config });
  } catch (err) {
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
      return res.status(400).json({ message: "No file uploaded" });
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
    const threshold = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
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
  downloadScheduleFileAdmin
};
