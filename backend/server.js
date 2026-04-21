const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const adminRoutes = require("./routes/adminRoutes");
const studentRoutes = require("./routes/studentRoutes");

const app = express();

/* ================= DATABASE CONNECTION ================= */
connectDB();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

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
const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

app.get(/^(?!\/admin|\/student|\/qr).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

/* ================= ERROR HANDLER (Fallback) ================= */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error", error: err.message });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
