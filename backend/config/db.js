const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB Connected Successfully");

    // Initialize Default Admin
    await createAdminIfNotExists();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
};

async function createAdminIfNotExists() {
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
  } catch (error) {
    console.error("Admin creation error:", error);
  }
}

module.exports = connectDB;
