const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected Successfully");

    // Initialize Default Admin & Staff
    await createAdminAndStaffIfNotExists();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

async function createAdminAndStaffIfNotExists() {
  try {
    const adminId = process.env.ADMIN_USERID || "CM.ADMIN";
    const adminPassword = process.env.ADMIN_PASSWORD || "growhigh";

    let admin = await User.findOne({ role: "admin" });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await User.create({
        userId: adminId,
        password: hashedPassword,
        role: "admin",
        firstLogin: true,
      });

      console.log(`✅ Default Admin Created with ID: ${adminId}`);
    } else {
      let isModified = false;
      if (admin.userId !== adminId) {
        console.log(`🔄 Renaming admin from ${admin.userId} to ${adminId}`);
        admin.userId = adminId;
        isModified = true;
      }
      
      const isMatch = await bcrypt.compare(adminPassword, admin.password);
      if (!isMatch) {
        console.log("🔄 Updating admin password in database to match configuration");
        admin.password = await bcrypt.hash(adminPassword, 10);
        isModified = true;
      }

      if (isModified) {
        await admin.save();
      }
    }

    const staffId = process.env.STAFF_USERID || "CM.COORDINATOR";
    const staffPassword = process.env.STAFF_PASSWORD || "growtogether";

    let staff = await User.findOne({ role: "staff" });

    if (!staff) {
      const hashedPassword = await bcrypt.hash(staffPassword, 10);

      await User.create({
        userId: staffId,
        password: hashedPassword,
        role: "staff",
        firstLogin: false,
      });

      console.log(`✅ Default Staff Created with ID: ${staffId}`);
    } else {
      let isModified = false;
      if (staff.userId !== staffId) {
        console.log(`🔄 Renaming staff from ${staff.userId} to ${staffId}`);
        staff.userId = staffId;
        isModified = true;
      }

      const isMatch = await bcrypt.compare(staffPassword, staff.password);
      if (!isMatch) {
        console.log("🔄 Updating staff password in database to match configuration");
        staff.password = await bcrypt.hash(staffPassword, 10);
        isModified = true;
      }

      if (isModified) {
        await staff.save();
      }
    }
  } catch (error) {
    console.error("Admin/Staff creation error:", error);
  }
}

module.exports = connectDB;
