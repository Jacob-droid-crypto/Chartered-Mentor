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
    const adminId = "ADMIN001";
    const adminPassword = "admin123";

    const admin = await User.findOne({ userId: adminId });

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      await User.create({
        userId: adminId,
        password: hashedPassword,
        role: "admin",
        firstLogin: true,
      });

      console.log("✅ Default Admin Created");
    }

    const staffId = "STAFF001";
    const staffPassword = "staffPass@2026";

    const staff = await User.findOne({ userId: staffId });

    if (!staff) {
      const hashedPassword = await bcrypt.hash(staffPassword, 10);

      await User.create({
        userId: staffId,
        password: hashedPassword,
        role: "staff",
        firstLogin: false,
      });

      console.log("✅ Default Staff Created");
    } else if (staff.role !== "staff") {
      staff.role = "staff";
      await staff.save();
      console.log("✅ STAFF001 role updated to staff");
    }
  } catch (error) {
    console.error("Admin/Staff creation error:", error);
  }
}

module.exports = connectDB;
