const express = require("express");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const connectDB = require("./config/db");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");
const { initCronJobs } = require("./utils/cronJobs");

const app = express();

/* ================= DATABASE CONNECTION ================= */
connectDB();

// Run a one-time migration to clean up any base64 profile photos to free up DB storage immediately
const User = require("./models/User");
User.updateMany({ profilePhoto: { $exists: true } }, { $unset: { profilePhoto: "" } })
  .then((res) => console.log(`🧹 Cleared profile photos from database to reclaim storage:`, res))
  .catch((err) => console.error(`Error clearing profile photos:`, err));

// Seed default batches if not present
const Batch = require("./models/Batch");
Batch.countDocuments()
  .then((count) => {
    if (count === 0) {
      return Batch.insertMany([
        { name: "September 2026" },
        { name: "November 2026" }
      ]);
    }
  })
  .then((res) => {
    if (res) console.log("🌱 Seeded default batches:", res.map(b => b.name));
  })
  .catch((err) => console.error("Error seeding default batches:", err));

/* ================= BACKGROUND JOBS ================= */
initCronJobs();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

/* ================= ROUTES ================= */
app.use("/admin", adminRoutes);
app.use("/student", studentRoutes);

/* ================= QR ENTRY ROUTES ================= */
// Check-IN QR
app.get("/qr/in", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>QR Check-IN</title>
      </head>
      <body>
        <script>
          localStorage.setItem("qrValue", "CM-ATTENDANCE-IN");
          window.location.href = "/qr-scan.html";
        </script>
      </body>
    </html>
  `);
});

// Check-OUT QR
app.get("/qr/out", (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>QR Check-OUT</title>
      </head>
      <body>
        <script>
          localStorage.setItem("qrValue", "CM-ATTENDANCE-OUT");
          window.location.href = "/qr-scan.html";
        </script>
      </body>
    </html>
  `);
});

/* ================= STATIC FRONTEND SUPPORT ================= */
app.use(express.static(path.join(__dirname, "public")));
const frontendPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendPath));

app.get(/^(?!\/admin|\/student|\/qr).*/, (req, res) => {
  const indexPath = path.join(frontendPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(indexPath);
  } else {
    res.status(200).send("Chartered Mentor API Server is running.");
  }
});

/* ================= ERROR HANDLER (Fallback) ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error", error: err.message });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

module.exports = app;

// Trigger Vercel backend deployment - Fine Management System
