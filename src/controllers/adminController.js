const adminModel = require("../models/adminModel");
const bcrypt = require("bcrypt");
const { EncodeToken } = require("../utility/tokenHelper.js");

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

// Create-admin
exports.register = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Check if admin already exists
        const existingAdmin = await adminModel.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin with this email already exists",
            });
        }

        // Create new admin (password hashing is handled automatically by the model pre-save hook)
        const newAdmin = await adminModel.create({ email, password });

        // Exclude sensitive data (password) from the response
        const adminResponse = {
            _id: newAdmin._id,
            email: newAdmin.email,
            createdAt: newAdmin.createdAt,
            updatedAt: newAdmin.updatedAt,
        };

        return res.status(201).json({
            success: true,
            message: "Admin created successfully",
            data: adminResponse,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// Admin-login
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

        const user = await adminModel.findOne({ email });
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
        res.cookie("a__token", token, getCookieOptions(req, true));

        return res.status(200).json({
            success: true,
            message: "Login successful",
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

// Admin-Read
exports.admin = async (req, res) => {
    try {
        const email = req.headers.email?.trim().toLowerCase();
        const data = await adminModel.findOne({ email }).select("-password");

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

// Admin-verify
exports.adminVerify = async (req, res) => {
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

// Admin-logout
exports.logout = async (req, res) => {
    try {
        res.clearCookie("a__token", getCookieOptions(req, false));

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

// Admin-Update
exports.update = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        const { password } = req.body;
        const _id = req.headers._id;

        const user = await adminModel.findById(_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Admin not found.",
            });
        }

        const updatedData = {};
        if (email) updatedData.email = email;

        // Hash password only if a new one is provided
        if (password) {
            updatedData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await adminModel.findByIdAndUpdate(_id, updatedData, {
            returnDocument: "after",
            runValidators: true,
        });

        const token = EncodeToken(updatedUser.email, updatedUser._id.toString());

        res.cookie("a__token", token, getCookieOptions(req, true));

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: {
                id: updatedUser._id,
                email: updatedUser.email,
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