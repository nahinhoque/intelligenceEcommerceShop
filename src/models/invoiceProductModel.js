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
        cart_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "carts",
        },
        product_name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true
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
        color: {
            type: String,
            required: [true, "Color is required"]
        },
        size: {
            type: String,
            required: [true, "Size is required"]
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const invoiceProductModel = mongoose.model("invoicesproducts", DataSchema);

module.exports = invoiceProductModel;