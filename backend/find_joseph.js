const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://charteredmentorcochin_db_user:3XF4bo3UKz74lU5c@cluster0.3pvewea.mongodb.net/charteredmentor?retryWrites=true&w=majority";

async function findJoseph() {
  try {
    await mongoose.connect(uri);
    const users = await User.find({ name: /Joseph/i }).lean();
    console.log(`Found ${users.length} users with name 'Joseph':`, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
findJoseph();
