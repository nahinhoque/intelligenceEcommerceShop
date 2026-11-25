const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
    {
        filename: {
            type: String,
            required: [true, "Filename is required"],
            trim: true,
        },
        storageProvider: {
            type: String,
            enum: ["local", "cloudinary"],
            default: "local",
        },
        cloudinaryPublicId: {
            type: String,
            trim: true,
        },
        secureUrl: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const fileModel = mongoose.model("files", DataSchema);

module.exports = fileModel;