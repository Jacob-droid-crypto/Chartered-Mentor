const mongoose = require("mongoose");
require("dotenv").config();
const Batch = require("./models/Batch");

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to DB.");
    const count = await Batch.countDocuments();
    console.log("Batch Count:", count);
    const list = await Batch.find({});
    console.log("Batches:", list);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
