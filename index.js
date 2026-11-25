const mongoose = require("mongoose");
require("dotenv").config();
const app = require("./app");
const { expirePendingReservations } = require("./src/services/invoicePaymentLifecycle.js");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

async function startServer() {
  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log("Connected to MongoDB Atlas");

    const cleanupExpiredReservations = () => {
      expirePendingReservations().catch((err) => {
        console.error("Could not release expired payment reservations:", err);
      });
    };
    cleanupExpiredReservations();
    const reservationCleanup = setInterval(cleanupExpiredReservations, 60 * 1000);
    reservationCleanup.unref();

    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Closing server...`);
      clearInterval(reservationCleanup);
      server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

startServer();