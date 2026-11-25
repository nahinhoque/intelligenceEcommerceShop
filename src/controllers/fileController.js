const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const fileModel = require("../models/fileModel.js");
const getCloudinary = require("../config/cloudinary.js");

const uploadBuffer = (cloudinary, buffer, filename) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "intellig-ecommerce",
                public_id: filename,
                overwrite: false,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else if (!result?.public_id || !result?.secure_url) {
                    reject(new Error("Cloudinary returned an incomplete upload result."));
                } else {
                    resolve(result);
                }
            }
        );

        stream.end(buffer);
    });

// File Upload
exports.fileUpload = async (req, res) => {
    let cloudinary;
    let uploadedFile;

    try {
        if (!req.file?.buffer) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded.",
            });
        }

        cloudinary = getCloudinary();
        const extensionByMimeType = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        };
        const filename = `api-img-${Date.now()}-${randomUUID()}${
            extensionByMimeType[req.file.mimetype]
        }`;

        uploadedFile = await uploadBuffer(
            cloudinary,
            req.file.buffer,
            filename
        );

        const data = await fileModel.create({
            filename,
            storageProvider: "cloudinary",
            cloudinaryPublicId: uploadedFile.public_id,
            secureUrl: uploadedFile.secure_url,
        });

        return res.status(201).json({
            success: true,
            message: "File uploaded successfully.",
            data,
        });
    } catch (error) {
        if (uploadedFile?.public_id && cloudinary) {
            try {
                await cloudinary.uploader.destroy(uploadedFile.public_id, {
                    resource_type: "image",
                });
            } catch (cleanupError) {
                console.error(
                    "Could not remove orphaned Cloudinary upload:",
                    cleanupError.message
                );
            }
        }

        console.error("File upload failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "File upload failed. Check the server configuration and logs.",
        });
    }
};

// Redirect stored Cloudinary images; fall through for legacy local uploads.
exports.getFile = async (req, res, next) => {
    const file = await fileModel
        .findOne({ filename: req.params.filename, storageProvider: "cloudinary" })
        .select("secureUrl");

    if (file?.secureUrl) {
        return res.redirect(302, file.secureUrl);
    }

    return next();
};

// Get all files
exports.allFile = async (req, res) => {
    try {
        const page_no = Math.max(1, Math.min(Number(req.params.page_no) || 1, 100000));
        const per_page = Math.max(1, Math.min(Number(req.params.per_page) || 10, 100));
        const skipRow = (page_no - 1) * per_page;

        const files = await fileModel.aggregate([
            {
                $facet: {
                    totalCount: [{ $count: "count" }],
                    files: [
                        { $sort: { createdAt: -1 } },
                        { $skip: skipRow },
                        { $limit: per_page },
                        { $project: { updatedAt: 0 } },
                    ],
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            message: "Files fetched successfully",
            data: files[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// Remove files
exports.fileRemove = async (req, res) => {
    try {
        const _id = String(req.body?._id || "").trim();
        const filename = String(req.body?.filename || "").trim();

        if (!_id || !filename || path.basename(filename) !== filename) {
            return res.status(400).json({
                success: false,
                message: "Valid _id and filename are required.",
            });
        }

        const file = await fileModel.findOne({ _id, filename });
        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found.",
            });
        }

        if (file.storageProvider === "cloudinary" && file.cloudinaryPublicId) {
            const result = await getCloudinary().uploader.destroy(
                file.cloudinaryPublicId,
                { resource_type: "image", invalidate: true }
            );

            if (!["ok", "not found"].includes(result?.result)) {
                throw new Error("Cloudinary did not confirm file deletion.");
            }
        } else {
            const uploadDir = path.resolve(__dirname, "../../uploads");
            const filePath = path.join(uploadDir, filename);

            try {
                await fs.unlink(filePath);
            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
        }

        await fileModel.deleteOne({ _id, filename });

        return res.status(200).json({
            success: true,
            message: "File removed successfully.",
        });
    } catch (error) {
        console.error("File removal failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "File removal failed. Check the server logs.",
        });
    }
};
