const jwt = require("jsonwebtoken");

const EncodeToken = (email, id) => {
    const key = process.env.JWT_KEY;
    const expire = process.env.JWT_Expire_Time || "24h";

    if (!key) {
        throw new Error("JWT_KEY is not defined in environment variables.");
    }

    const payload = { email, id, _id: id };
    return jwt.sign(payload, key, { expiresIn: expire });
};

const DecodeToken = (token) => {
    try {
        const key = process.env.JWT_KEY;
        if (!key || !token) return null;

        const decoded = jwt.verify(token, key);
        return decoded && decoded._id ? decoded : { ...decoded, _id: decoded?.id };
    } catch (error) {
        return null;
    }
};

module.exports = {
    EncodeToken,
    DecodeToken,
};