const cron = require('node-cron');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AttendanceAdjustment = require('../models/AttendanceAdjustment');
const GoalConfig = require('../models/GoalConfig');
const Schedule = require('../models/Schedule');
const QuestionPaper = require('../models/QuestionPaper');
const { sendTwilioMessage } = require('./twilio');

const getISTDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
};

const resolveStudentGoalForDate = async (studentId, dateStr) => {
  const configs = await GoalConfig.find({});
  const studentConfigs = configs.filter(c => c.studentId === studentId);
  studentConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  let active = studentConfigs.find(c => c.effectiveFrom <= dateStr);
  if (!active) {
    const defaultConfigs = configs.filter(c => !c.studentId);
    defaultConfigs.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    active = defaultConfigs.find(c => c.effectiveFrom <= dateStr) || defaultConfigs[defaultConfigs.length - 1];
  }
  return active;
};

const calculateStudyHours = async (studentId, dateStr) => {
  const logs = await Attendance.find({ studentId, date: dateStr }).sort({ timestamp: 1 });
  let totalMs = 0;
  let lastInTime = null;
  
  logs.forEach(log => {
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
    if (dateStr === today) {
      totalMs += Math.max(0, Date.now() - lastInTime);
    } else {
      const latestLog = logs[logs.length - 1];
      const latestTime = latestLog.timestamp ? new Date(latestLog.timestamp).getTime() : (latestLog.createdAt ? new Date(latestLog.createdAt).getTime() : 0);
      totalMs += Math.max(0, latestTime - lastInTime);
    }
  }

  const rawHours = totalMs / (1000 * 60 * 60);
  const adjustment = await AttendanceAdjustment.findOne({ studentId, date: dateStr });
  if (!adjustment) return rawHours;

  const adjType = adjustment.type || (adjustment.deductionMinutes > 0 ? "DEDUCT" : (adjustment.minutes > 0 ? "ADD" : "NONE"));
  const mins = adjustment.minutes !== undefined ? adjustment.minutes : (adjustment.deductionMinutes || 0);
  const adjHours = mins / 60;

  if (adjType === "ADD") {
    return rawHours + adjHours;
  } else if (adjType === "DEDUCT") {
    return Math.max(0, rawHours - adjHours);
  }
  return rawHours;
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
      await executeAutoLogout();
    } catch (error) {
      console.error("Error in scheduled auto logout job:", error);
    }
  });

  // Cleanup Cron Job - Runs daily at midnight to purge old schedules and question papers from MongoDB
  cron.schedule('0 0 * * *', async () => {
    console.log("Running scheduled auto-delete cleanup for old schedules and question papers...");
    try {
      // 1. Delete schedules opened more than 10 days ago
      const scheduleThreshold = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const scheduleRes = await Schedule.deleteMany({ openedAt: { $ne: null, $lte: scheduleThreshold } });
      if (scheduleRes.deletedCount > 0) {
        console.log(`🧹 [Cron Cleanup] Auto-deleted ${scheduleRes.deletedCount} schedules.`);
      }

      // 2. Delete question papers started more than 3 days ago (only if no answer sheet uploaded)
      const paperThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const paperRes = await QuestionPaper.deleteMany({ startTime: { $ne: null, $lte: paperThreshold }, answerFileData: null });
      if (paperRes.deletedCount > 0) {
        console.log(`🧹 [Cron Cleanup] Auto-deleted ${paperRes.deletedCount} question papers.`);
      }
    } catch (error) {
      console.error("Error in auto-delete cleanup cron job:", error);
    }
  });

  // Twilio parents alert - Late Check-In (Runs daily at 11:00 AM)
  cron.schedule('0 11 * * *', async () => {
    console.log("Running Twilio late check-in alert cron job...");
    try {
      const todayStr = getISTDateString();
      const todayDayIndex = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).getDay();
      const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];

      const students = await User.find({ role: 'student', userId: 'INT26122', active: { $ne: false } });

      for (const student of students) {
        // Resolve goal target
        const goal = await resolveStudentGoalForDate(student.userId, todayStr);
        const target = goal ? goal[todayKey] : 12;
        
        // If target is 0 (Holiday), skip
        if (target <= 0) continue;

        // Check if student checked in today
        const hasCheckedIn = await Attendance.findOne({ studentId: student.userId, date: todayStr, type: 'IN' });

        if (!hasCheckedIn) {
          const parentPhone = student.fatherPhone || student.motherPhone;
          if (parentPhone) {
            const alertMsg = `Dear Parent, this is an alert from Chartered Mentor. Your ward, ${student.name} (ID: ${student.userId}), has not checked in for study today as of 11:00 AM. Please verify.`;
            await sendTwilioMessage(parentPhone, alertMsg);
          }
        }
      }
    } catch (err) {
      console.error("Error in Twilio late check-in cron job:", err);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // Twilio parents alert - Daily target shortfall (Runs daily at 10:05 PM)
  cron.schedule('5 22 * * *', async () => {
    console.log("Running Twilio study shortfall alert cron job...");
    try {
      const todayStr = getISTDateString();
      const todayDayIndex = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).getDay();
      const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];

      const students = await User.find({ role: 'student', userId: 'INT26122', active: { $ne: false } });

      for (const student of students) {
        // Resolve goal target
        const goal = await resolveStudentGoalForDate(student.userId, todayStr);
        const target = goal ? goal[todayKey] : 12;
        
        // If target is 0 (Holiday), skip
        if (target <= 0) continue;

        // Calculate actual study hours
        const actualHours = await calculateStudyHours(student.userId, todayStr);

        if (actualHours < target) {
          const parentPhone = student.fatherPhone || student.motherPhone;
          if (parentPhone) {
            const actualFormatted = actualHours.toFixed(2);
            const alertMsg = `Dear Parent, your ward ${student.name} (ID: ${student.userId}) completed ${actualFormatted} hours of study today, falling short of their daily target of ${target} hours. — Chartered Mentor`;
            await sendTwilioMessage(parentPhone, alertMsg);
          }
        }
      }
    } catch (err) {
      console.error("Error in Twilio shortfall cron job:", err);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });
  
  console.log("Cron jobs initialized.");
};

const executeAutoLogout = async () => {
  const stats = { checkedOut: [], skippedOnline: [], errors: 0 };
  try {
    // Find all students whose last attendance record is "IN"
    const checkedIn = await Attendance.aggregate([
      { $sort: { timestamp: 1, createdAt: 1 } },
      {
        $group: {
          _id: "$studentId",
          lastRecord: { $last: "$$ROOT" }
        }
      },
      {
        $match: {
          "lastRecord.type": "IN"
        }
      }
    ]);

    if (checkedIn.length === 0) {
      return stats;
    }

    const todayStr = getISTDateString();
    const now = new Date();

    // Retrieve all global configurations to resolve effective configs quickly
    const defaultConfigs = await GoalConfig.find({ studentId: null }).sort({ effectiveFrom: -1 });

    for (const group of checkedIn) {
      const studentId = group._id;
      const lastInLog = group.lastRecord;
      const checkInDate = lastInLog.date; // YYYY-MM-DD format

      // Resolve active goal configuration on the check-in date
      const config = defaultConfigs.find(c => c.effectiveFrom <= checkInDate) || defaultConfigs[defaultConfigs.length - 1];

      if (!config || !config.autoLogoutEnabled || !config.autoLogoutTime) {
        continue;
      }

      // Auto logout threshold for that specific check-in date
      const autoLogoutTimestamp = new Date(`${checkInDate}T${config.autoLogoutTime}:00+05:30`);

      // Determine if we should trigger checkout
      let shouldCheckout = false;
      let checkoutTimestamp = autoLogoutTimestamp;

      if (checkInDate < todayStr) {
        // If check-in date is a past day, they should always be logged out (since we are past that day's auto-logout window)
        shouldCheckout = true;
        // If the student checked in *after* the auto-logout time of that day, set checkout to 23:59:59 of that day
        // to prevent negative duration (checkout timestamp preceding check-in timestamp)
        if (new Date(lastInLog.timestamp) >= autoLogoutTimestamp) {
          checkoutTimestamp = new Date(`${checkInDate}T23:59:59+05:30`);
        }
      } else if (checkInDate === todayStr) {
        // If check-in date is today, checkout only if the current time is past the auto-logout time
        if (now >= autoLogoutTimestamp && new Date(lastInLog.timestamp) < autoLogoutTimestamp) {
          shouldCheckout = true;
        }
      }

      if (shouldCheckout) {
        const student = await User.findOne({ userId: studentId });
        if (student) {
          if (student.mode === 'online') {
            console.log(`[Auto Logout] Skipping student ${studentId} because mode is online.`);
            stats.skippedOnline.push(studentId);
            continue;
          }
          console.log(`[Auto Logout] Checking OUT student ${studentId} automatically for date ${checkInDate} target time ${config.autoLogoutTime}`);
          
          await Attendance.create({
            studentId,
            course: student.course,
            type: 'OUT',
            date: checkInDate,
            timestamp: checkoutTimestamp
          });

          stats.checkedOut.push({ studentId, date: checkInDate, time: config.autoLogoutTime });
        }
      }
    }
  } catch (error) {
    console.error("Error in executeAutoLogout:", error);
    stats.errors++;
  }
  return stats;
};

module.exports = { initCronJobs, executeAutoLogout };
