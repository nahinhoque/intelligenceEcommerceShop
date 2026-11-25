const { DecodeToken } = require("../utility/tokenHelper.js");

module.exports = (req, res, next) => {
    const token = req.cookies?.a__token;
    const decoded = DecodeToken(token);

    if (!decoded) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid or expired token",
        });
    }

    const { email, _id, id } = decoded;
    const adminId = _id || id;

    if (!email || !adminId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized: Invalid admin token",
        });
    }

    req.headers.email = email;
    req.headers._id = adminId;

    next();
};