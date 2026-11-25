const { v2: cloudinary } = require("cloudinary");

let isConfigured = false;

const getCloudinary = () => {
    const config = {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    };

    const missingConfig = ["cloud_name", "api_key", "api_secret"].filter(
        (key) => !config[key]
    );

    if (missingConfig.length) {
        throw new Error(
            "Cloudinary configuration is incomplete. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
        );
    }

    if (!isConfigured) {
        cloudinary.config(config);
        isConfigured = true;
    }

    return cloudinary;
};

module.exports = getCloudinary;
