const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const app = express();
const router = require("./src/routes/api");

const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.disable("x-powered-by");

// Global Middlewares
app.use(
    helmet.contentSecurityPolicy({
        useDefaults: true,
        directives: {
            "img-src": ["'self'", "https: data:"],
        },
    })
);

app.use(
    cors({
        origin: allowedOrigins.length ? allowedOrigins : false,
        credentials: true,
    })
);

// Make req.query writable before express-mongo-sanitize runs
app.use((req, res, next) => {
    Object.defineProperty(req, "query", {
        ...Object.getOwnPropertyDescriptor(req, "query"),
        value: req.query,
        writable: true,
    });
    next();
});

app.use(mongoSanitize());
app.use(hpp());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3000 }); // 3000 requests per 15 minutes
app.use(limiter);

// API Routes
app.use("/api/v1", router);
app.use("/api/v1/get-file", express.static("uploads"));

// Frontend Static Serving
app.use(
    "/super-admin",
    express.static(path.join(__dirname, "client", "super-admin", "dist"), {
        index: false,
    })
);

app.get("/super-admin/{*splat}", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "client", "super-admin", "dist", "index.html")
    );
});

app.use(express.static(path.join(__dirname, "client", "ecommerce", "dist")));

app.get("/{*splat}", (req, res) => {
    res.sendFile(
        path.resolve(__dirname, "client", "ecommerce", "dist", "index.html")
    );
});

module.exports = app;