const multer = require("multer");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 }, // 200 KB
    fileFilter: (req, file, cb) => {
        const supportedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
        ];

        if (!supportedTypes.includes(file.mimetype)) {
            return cb(
                new Error("Only JPEG, PNG, WebP, and GIF images are supported.")
            );
        }

        cb(null, true);
    },
});

const fileUpload = (req, res, next) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            if (err?.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File too large! Maximum size is 200 KB.",
                });
            }

            return res.status(400).json({
                success: false,
                message: err.message || "File upload failed.",
            });
        }

        next();
    });
};

module.exports = fileUpload;
