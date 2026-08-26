require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Attendance = require('./models/Attendance');
const GoalConfig = require('./models/GoalConfig');
const { sendTwilioMessage } = require('./utils/twilio');

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

  return totalMs / (1000 * 60 * 60);
};

const runTest = async () => {
  console.log("\n=== TWILIO ALERT AUTOMATION TEST SYSTEM ===");
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Error: MONGODB_URI is not defined in .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB successfully.");

    const todayStr = getISTDateString();
    const todayDayIndex = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000).getDay();
    const todayKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][todayDayIndex];
    console.log(`Target Date: ${todayStr} (Weekday: ${todayKey.toUpperCase()})\n`);

    const students = await User.find({ role: 'student', active: { $ne: false } });
    console.log(`Found ${students.length} active students in the database.`);

    console.log("\n-----------------------------------------");
    console.log("1. SIMULATING LATE CHECK-IN ALERTS (11:00 AM logic)...");
    console.log("-----------------------------------------");
    for (const student of students) {
      const goal = await resolveStudentGoalForDate(student.userId, todayStr);
      const target = goal ? goal[todayKey] : 12;

      console.log(`Student: ${student.name} (${student.userId}) - Target study hours today: ${target}h`);
      if (target <= 0) {
        console.log(`   -> Skipped (Target is 0h, holiday).\n`);
        continue;
      }

      const hasCheckedIn = await Attendance.findOne({ studentId: student.userId, date: todayStr, type: 'IN' });
      if (!hasCheckedIn) {
        const parentPhone = student.fatherPhone || student.motherPhone;
        console.log(`   -> [ALERT TRIGGERED] Student has NOT checked in today.`);
        console.log(`   -> Parent Contact: ${parentPhone || 'No contact configured'}`);
        if (parentPhone) {
          const alertMsg = `Dear Parent, this is an alert from Chartered Mentor. Your ward, ${student.name} (ID: ${student.userId}), has not checked in for study today as of 11:00 AM. Please verify.`;
          console.log(`   -> Message body: "${alertMsg}"`);
          console.log(`   -> Dispatching message via Twilio...`);
          const res = await sendTwilioMessage(parentPhone, alertMsg);
          if (res.success) {
            console.log(`   -> [SUCCESS] Message sent. Twilio SID: ${res.sid}\n`);
          } else {
            console.log(`   -> [FAILED] Twilio Error: ${res.error}\n`);
          }
        } else {
          console.log(`   -> [FAILED] Skipped sending (No parent phone configured).\n`);
        }
      } else {
        console.log(`   -> Status: Safe (Already checked in today).\n`);
      }
    }

    console.log("-----------------------------------------");
    console.log("2. SIMULATING STUDY SHORTFALL ALERTS (10:05 PM logic)...");
    console.log("-----------------------------------------");
    for (const student of students) {
      const goal = await resolveStudentGoalForDate(student.userId, todayStr);
      const target = goal ? goal[todayKey] : 12;

      console.log(`Student: ${student.name} (${student.userId}) - Target: ${target}h`);
      if (target <= 0) {
        console.log(`   -> Skipped (Target is 0h, holiday).\n`);
        continue;
      }

      const actualHours = await calculateStudyHours(student.userId, todayStr);
      console.log(`   -> Actual study completed today so far: ${actualHours.toFixed(2)}h`);

      if (actualHours < target) {
        const parentPhone = student.fatherPhone || student.motherPhone;
        console.log(`   -> [ALERT TRIGGERED] Actual hours (${actualHours.toFixed(2)}h) is less than target (${target}h).`);
        console.log(`   -> Parent Contact: ${parentPhone || 'No contact configured'}`);
        if (parentPhone) {
          const alertMsg = `Dear Parent, your ward ${student.name} (ID: ${student.userId}) completed ${actualHours.toFixed(2)} hours of study today, falling short of their daily target of ${target} hours. — Chartered Mentor`;
          console.log(`   -> Message body: "${alertMsg}"`);
          console.log(`   -> Dispatching message via Twilio...`);
          const res = await sendTwilioMessage(parentPhone, alertMsg);
          if (res.success) {
            console.log(`   -> [SUCCESS] Message sent. Twilio SID: ${res.sid}\n`);
          } else {
            console.log(`   -> [FAILED] Twilio Error: ${res.error}\n`);
          }
        } else {
          console.log(`   -> [FAILED] Skipped sending (No parent phone configured).\n`);
        }
      } else {
        console.log(`   -> Status: Goal completed! (${actualHours.toFixed(2)}h completed vs ${target}h target).\n`);
      }
    }

    console.log("=== TEST SUITE COMPLETED ===\n");
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    mongoose.disconnect();
  }
};

runTest();
