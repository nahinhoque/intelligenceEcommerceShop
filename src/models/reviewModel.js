const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: [true, "User ID is required"]
        },
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "products",
            required: [true, "Product ID is required"]
        },
        invoice_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "invoices",
            required: [true, "Invoice ID is required"]
        },
        des: {
            type: String,
            required: [true, "Review description is required"],
            trim: true
        },
        rating: {
            type: Number,
            required: [true, "Rating is required"],
            min: [1, "Rating must be at least 1 star"],
            max: [5, "Rating cannot exceed 5 stars"]
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const reviewModel = mongoose.model("reviews", DataSchema);

module.exports = reviewModel;