const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
    {
        brand_name: { 
            type: String, 
            unique: true, 
            required: [true, "Brand name is required"],
            trim: true,
            lowercase: true 
        },
        brand_img: { 
            type: String, 
            required: [true, "Brand image is required"] 
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const brandModel = mongoose.model("brands", DataSchema);

module.exports = brandModel;