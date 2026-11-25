const userModel = require("../models/userModel.js");
const { EncodeToken } = require("../utility/tokenHelper.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const TokenBlacklist = require("../models/TokenBlacklistModel.js");

const getCookieOptions = (req, includeMaxAge = true) => {
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    const options = {
        httpOnly: false,
        sameSite: isSecure ? "none" : "lax",
        secure: isSecure,
        path: "/",
    };

    if (includeMaxAge) {
        options.maxAge = Number(process.env.Cookie_Expire_Time) || 24 * 60 * 60 * 1000;
    }

    return options;
};

// Create user
exports.register = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required.",
            });
        }

        // Find the existing user
        const ifUser = await userModel.findOne({ email });
        if (ifUser) {
            return res.status(400).json({
                success: false,
                message: "Email already registered.",
            });
        }

        // Create and save the new user
        const user = await userModel.create({ email, password });

        return res.status(201).json({
            success: true,
            message: "Registration successfully.",
            data: {
                _id: user._id,
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// User Login
exports.login = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = EncodeToken(user.email, user._id.toString());

        // Set cookie and send response
        res.cookie("u__token", token, getCookieOptions(req, true));

        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id,
                email: user.email,
            },
            token,
        });
    } catch (e) {
        return res.status(500).json({
            success: false,
            error: e.toString(),
            message: "Something went wrong.",
        });
    }
};

// Get User
exports.user = async (req, res) => {
    try {
        const email = req.headers.email?.trim().toLowerCase();
        const data = await userModel.findOne({ email }).select("-password");

        return res.status(200).json({
            success: true,
            data: data || null,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// User Verify
exports.userVerify = (req, res) => {
    try {
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// User Logout
exports.logout = async (req, res) => {
    try {
        const token =
            req.cookies?.u__token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.split(" ")[1]
                : null);

        if (token) {
            const decoded = jwt.decode(token);
            const expiresAt = decoded?.exp
                ? new Date(decoded.exp * 1000)
                : new Date(Date.now() + 24 * 60 * 60 * 1000);

            await TokenBlacklist.updateOne(
                { token },
                { $setOnInsert: { token, expiresAt } },
                { upsert: true }
            );
        }

        res.clearCookie("u__token", getCookieOptions(req, false));

        return res.status(200).json({
            success: true,
            message: "Logout success!",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// Update user
exports.update = async (req, res) => {
    try {
        const email = req.headers.email?.trim().toLowerCase();
        const _id = req.headers._id;

        const {
            password,
            image,
            cus_add,
            cus_city,
            cus_country,
            cus_fax,
            cus_name,
            cus_phone,
            cus_postcode,
            cus_state,
            ship_add,
            ship_city,
            ship_country,
            ship_name,
            ship_phone,
            ship_postcode,
            ship_state,
        } = req.body;

        // Build update payload with only defined fields so existing data isn't wiped
        const updatedData = Object.fromEntries(
            Object.entries({
                image,
                cus_add,
                cus_city,
                cus_country,
                cus_fax,
                cus_name,
                cus_phone,
                cus_postcode,
                cus_state,
                ship_add,
                ship_city,
                ship_country,
                ship_name,
                ship_phone,
                ship_postcode,
                ship_state,
            }).filter(([_, value]) => value !== undefined)
        );

        if (password) {
            updatedData.password = await bcrypt.hash(password, 10);
        }

        const user = await userModel
            .findOneAndUpdate(
                { _id, email },
                { $set: updatedData },
                { returnDocument: "after", runValidators: true }
            )
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found or invalid email.",
            });
        }

        const token = EncodeToken(user.email, user._id.toString());

        res.cookie("u__token", token, getCookieOptions(req, true));

        return res.status(200).json({
            success: true,
            message: "Update data successful",
            user: {
                id: user._id,
                email: user.email,
            },
            token,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};