const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "users",
            required: [true, "User ID is required"]
        },
        payable: {
            type: Number,
            required: [true, "Payable amount is required"]
        },
        cus_details: {
            type: Object,
            required: [true, "Customer details are required"]
        },
        ship_details: {
            type: Object,
            required: [true, "Shipping details are required"]
        },
        tran_id: {
            type: String,
            required: [true, "Transaction ID is required"]
        },
        val_id: {
            type: String,
            default: "0"
        },
        deliver_status: {
            type: String,
            required: true,
            enum: ["pending", "processing", "delivered", "cancel"],
            default: "pending"
        },
        payment_status: {
            type: String,
            required: true,
            enum: ["pending", "success", "cancel", "fail", "expired", "refund_required"],
            default: "pending"
        },
        stock_reserved: {
            type: Boolean,
            default: false,
        },
        reservation_expires_at: {
            type: Date,
            default: null,
        },
        vat: {
            type: Number,
            required: [true, "VAT amount is required"]
        },
        total: {
            type: Number,
            required: [true, "Total amount is required"]
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const invoiceModel = mongoose.model("invoices", DataSchema);

module.exports = invoiceModel;