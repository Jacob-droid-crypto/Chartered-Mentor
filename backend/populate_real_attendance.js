require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Attendance = require('./models/Attendance');

const getISTDateString = (date = new Date()) => {
  const shifted = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().split("T")[0];
};

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("MONGODB_URI is not defined in .env");
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("Connected to MongoDB successfully.");

    const todayStr = getISTDateString();
    console.log(`Target Date (IST): ${todayStr}`);

    // Remove existing attendance logs for today to start fresh
    const deleteRes = await Attendance.deleteMany({ date: todayStr });
    console.log(`Cleared ${deleteRes.deletedCount} existing attendance records for today.`);

    // Fetch all students
    const students = await User.find({ role: 'student' });
    console.log(`Found ${students.length} students in the database.`);

    if (students.length === 0) {
      console.log("No student records found to populate.");
      process.exit(0);
    }

    let presentCount = 0;
    let absentCount = 0;

    for (let i = 0; i < students.length; i++) {
      const student = students[i];

      // Mark ~85% of students as present, others as absent
      const isAbsent = (i % 7 === 0); // Modulo pattern to make it deterministic but realistic
      if (isAbsent) {
        absentCount++;
        console.log(`Student ${student.name} (${student.userId}) left as Absent today.`);
        continue;
      }

      presentCount++;

      // Generate random-looking check-in/out times for today
      const inMinute = 10 + (i * 3) % 25; // 8:10 to 8:35 AM
      const outHour = 17 + (i * 2) % 4; // 5 PM to 8 PM
      const outMinute = (i * 7) % 60;

      const inTimestamp = new Date(`${todayStr}T08:${String(inMinute).padStart(2, '0')}:00+05:30`);
      const outTimestamp = new Date(`${todayStr}T${String(outHour).padStart(2, '0')}:${String(outMinute).padStart(2, '0')}:00+05:30`);

      // Create IN record
      await Attendance.create({
        studentId: student.userId,
        course: student.course || 'INTER',
        type: 'IN',
        date: todayStr,
        timestamp: inTimestamp
      });

      // Create OUT record
      await Attendance.create({
        studentId: student.userId,
        course: student.course || 'INTER',
        type: 'OUT',
        date: todayStr,
        timestamp: outTimestamp
      });

      console.log(`Marked ${student.name} (${student.userId}) as Present today. IN: 08:${inMinute} AM, OUT: ${outHour}:${outMinute}.`);
    }

    console.log(`\nFinished populating attendance for ${todayStr}.`);
    console.log(`Present: ${presentCount}`);
    console.log(`Absent: ${absentCount}`);

  } catch (err) {
    console.error("Error populating attendance:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
