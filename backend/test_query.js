const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://charteredmentorcochin_db_user:3XF4bo3UKz74lU5c@cluster0.3pvewea.mongodb.net/charteredmentor?retryWrites=true&w=majority";

async function test() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to new DB.");
    const total = await User.countDocuments({});
    const students = await User.countDocuments({ role: 'student' });
    const admins = await User.countDocuments({ role: 'admin' });
    const staff = await User.countDocuments({ role: 'staff' });
    const sample = await User.find({}, { password: 0 }).limit(3).lean();
    console.log(`Total: ${total}, Students: ${students}, Admins: ${admins}, Staff: ${staff}`);
    console.log("Sample documents:", JSON.stringify(sample, null, 2));
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await mongoose.connection.close();
  }
}
test();
