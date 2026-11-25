const { DecodeToken } = require("../utility/tokenHelper.js");
const TokenBlacklist = require("../models/TokenBlacklistModel");

module.exports = async (req, res, next) => {
    try {
        const token = req.cookies?.u__token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: No token provided",
            });
        }

        // Check if token was revoked on logout
        const isBlacklisted = await TokenBlacklist.exists({ token });
        if (isBlacklisted) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Token has been revoked",
            });
        }

        const decoded = DecodeToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid or expired token",
            });
        }

        const { email, _id, id } = decoded;
        const userId = _id || id;

        if (!email || !userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: Invalid user token",
            });
        }

        req.headers.email = email;
        req.headers._id = userId;

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};