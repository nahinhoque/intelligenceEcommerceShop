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
        product_name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true
        },
        color: {
            type: String,
            required: [true, "Color is required"]
        },
        size: {
            type: String,
            required: [true, "Size is required"]
        },
        qty: {
            type: Number,
            required: [true, "Quantity is required"],
            min: [1, "Quantity must be at least 1"]
        },
        price: {
            type: Number,
            required: [true, "Price is required"]
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const cartModel = mongoose.model("carts", DataSchema);

module.exports = cartModel;