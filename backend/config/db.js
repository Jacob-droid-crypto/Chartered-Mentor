const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Cached connection for Serverless environments (Vercel)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null, seeded: false };
}

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then(async (mongooseInstance) => {
      console.log("✅ MongoDB Connected Successfully");

      // Only check default accounts once per container lifetime
      if (!cached.seeded) {
        cached.seeded = true;
        try {
          await createAdminAndStaffIfNotExists();
        } catch (initErr) {
          console.error("Error checking default accounts:", initErr.message);
        }
      }

      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    console.error("❌ MongoDB connection error:", err);
    throw err;
  }

  return cached.conn;
};

async function createAdminAndStaffIfNotExists() {
  try {
    const adminId = process.env.ADMIN_USERID || "CM.ADMIN";
    const adminPassword = process.env.ADMIN_PASSWORD || "growhigh";

    // Fast check: Only check if an admin exists, skip heavy bcrypt on cold starts
    let admin = await User.findOne({ role: "admin" }).select("_id userId");

    if (!admin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        userId: adminId,
        password: hashedPassword,
        role: "admin",
        firstLogin: true,
      });
      console.log(`✅ Default Admin Created with ID: ${adminId}`);
    }

    const staffId = process.env.STAFF_USERID || "CM.COORDINATOR";
    const staffPassword = process.env.STAFF_PASSWORD || "mentorpath";

    // Fast check: Only check if a staff exists
    let staff = await User.findOne({ role: "staff" }).select("_id userId");

    if (!staff) {
      const hashedPassword = await bcrypt.hash(staffPassword, 10);
      await User.create({
        userId: staffId,
        password: hashedPassword,
        role: "staff",
        firstLogin: false,
      });
      console.log(`✅ Default Staff Created with ID: ${staffId}`);
    }
  } catch (error) {
    console.error("Admin/Staff creation error:", error);
  }
}

module.exports = connectDB;
