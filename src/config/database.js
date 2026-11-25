const mongoose = require("mongoose");

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected.");
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("MongoDB connected successfully.");
};

module.exports = connectDatabase;