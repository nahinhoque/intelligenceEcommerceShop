require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const fileModel = require("../src/models/fileModel.js");
const getCloudinary = require("../src/config/cloudinary.js");

const migrateUploads = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required.");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const cloudinary = getCloudinary();
    const uploadDirectory = path.resolve(__dirname, "../uploads");
    const files = await fileModel.find({
        storageProvider: { $ne: "cloudinary" },
    });

    for (const file of files) {
        const filename = path.basename(file.filename);
        const localPath = path.join(uploadDirectory, filename);

        await fs.access(localPath);
        const result = await cloudinary.uploader.upload(localPath, {
            folder: "intellig-ecommerce",
            public_id: filename,
            overwrite: true,
            resource_type: "image",
        });

        if (!result?.public_id || !result?.secure_url) {
            throw new Error(`Cloudinary returned an incomplete result for ${filename}.`);
        }

        await fileModel.updateOne(
            { _id: file._id },
            {
                $set: {
                    storageProvider: "cloudinary",
                    cloudinaryPublicId: result.public_id,
                    secureUrl: result.secure_url,
                },
            }
        );

        console.log(`Migrated ${filename}`);
    }

    console.log(`Migrated ${files.length} file(s).`);
};

migrateUploads()
    .catch((error) => {
        console.error("Upload migration failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
