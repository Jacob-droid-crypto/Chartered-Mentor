const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const GoalConfig = require('../models/GoalConfig');

const getISTDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
};

// Utility to send email
const sendFeeReminderEmail = async (student, balance, dueDateStr) => {
  const { email, name } = student;
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:5173";

  let emailSent = false;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h2 style="color: #ef4444; text-align: center;">Fee Payment Reminder</h2>
      <p>Hello ${name},</p>
      <p>This is a friendly reminder that your upcoming fee payment is due in <strong>2 days</strong>.</p>
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0;"><strong>Due Date:</strong> ${dueDateStr}</p>
        <p style="margin: 0;"><strong>Remaining Balance:</strong> ₹${balance}</p>
      </div>
      <p>Please log in to your dashboard to view the institute's payment instructions and clear your dues.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${frontendURL}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
      </div>
      <p style="font-size: 12px; color: #888; text-align: center;">If you have already made the payment, please disregard this email.</p>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Chartered Mentor <onboarding@resend.dev>",
        to: email,
        subject: "Action Required: Fee Payment Reminder",
        html: htmlContent,
      });
      if (!error) emailSent = true;
    } catch (err) {
      console.error("Resend throw error:", err);
    }
  }

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
      await transporter.sendMail({
        from: `"Chartered Mentor" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Action Required: Fee Payment Reminder",
        html: htmlContent
      });
      emailSent = true;
    } catch (err) {
      console.error("Nodemailer error:", err);
    }
  }

  if (!emailSent) {
    console.error("Failed to send fee reminder to:", email);
  } else {
    console.log("Fee reminder sent to:", email);
  }
};

const initCronJobs = () => {
  // Run everyday at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log("Running fee reminder cron job...");
    try {
      // Find students whose next payment is due in exactly 2 days
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

      const students = await User.find({
        role: "student",
        nextPaymentDueDate: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });

      for (const student of students) {
        const balance = (student.totalFees || 0) - (student.feesPaid || 0);
        if (balance > 0) {
          const dueDateStr = new Date(student.nextPaymentDueDate).toLocaleDateString();
          await sendFeeReminderEmail(student, balance, dueDateStr);
        }
      }
    } catch (error) {
      console.error("Error in fee reminder cron job:", error);
    }
  });

  // Auto Logout Cron Job - Runs every minute to checkout students who forgot
  cron.schedule('* * * * *', async () => {
    try {
      const config = await GoalConfig.findOne({ studentId: null }).sort({ effectiveFrom: -1 });
      if (!config || !config.autoLogoutEnabled || !config.autoLogoutTime) {
        return;
      }

      // Current date in IST
      const today = getISTDateString();
      
      // Target auto logout timestamp today in IST
      const autoLogoutTimestamp = new Date(`${today}T${config.autoLogoutTime}:00+05:30`);
      
      // Only run auto-logout if the current time is past the auto-logout time of today
      if (new Date() < autoLogoutTimestamp) {
        return;
      }

      // Find all attendance records for today, sorted by timestamp ascending
      const records = await Attendance.find({ date: today }).sort({ timestamp: 1 });
      
      // Determine which students are currently checked IN and their last check-in timestamp
      const inStudents = {}; // studentId -> { lastInLog }
      for (const r of records) {
        if (r.type === 'IN') {
          inStudents[r.studentId] = r;
        } else if (r.type === 'OUT') {
          delete inStudents[r.studentId];
        }
      }
      
      // For each student who is currently checked IN
      for (const studentId in inStudents) {
        const lastInLog = inStudents[studentId];
        // If their check-in time is before the auto logout threshold
        if (new Date(lastInLog.timestamp) < autoLogoutTimestamp) {
          // Fetch student course details from User collection
          const student = await User.findOne({ userId: studentId });
          if (student) {
            if (student.mode === 'online') {
              console.log(`[Auto Logout] Skipping student ${studentId} because mode is online.`);
              continue;
            }
            console.log(`[Auto Logout] Checking OUT student ${studentId} automatically for target time ${config.autoLogoutTime}`);
            await Attendance.create({
              studentId,
              course: student.course,
              type: 'OUT',
              date: today,
              timestamp: autoLogoutTimestamp
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in auto logout cron job:", error);
    }
  });
  
  console.log("Cron jobs initialized.");
};

module.exports = { initCronJobs };
