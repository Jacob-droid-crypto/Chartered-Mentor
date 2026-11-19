require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log("Connected to DB");
    try {
        const u = await User.findOne({ userId: "ADMIN001" });
        console.log("User retrieved:", u);
    } catch(e) {
        console.error("Error finding user:", e);
    }
    process.exit(0);
}).catch(e => {
    console.error("Connection error:", e);
    process.exit(1);
});
