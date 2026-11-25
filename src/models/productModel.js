const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
    {
        title: { 
            type: String, 
            required: [true, "Product title is required"], 
            trim: true 
        },
        images: { 
            type: [String], 
            required: [true, "At least one product image is required"] 
        },
        sort_description: { 
            type: String, 
            required: [true, "Short description is required"], 
            trim: true 
        },
        price: { 
            type: Number, 
            required: [true, "Product price is required"] 
        },
        is_discount: { 
            type: Boolean, 
            default: false 
        },
        discount_price: { 
            type: Number, 
            default: 0 
        },
        remark: { 
            type: String, 
            required: [true, "Remark is required"] // e.g., popular, new, featured
        },
        stock: { 
            type: Number, 
            required: [true, "Stock quantity is required"],
            min: [0, "Stock cannot be negative"]
        },
        color: { 
            type: [String] 
        },
        size: { 
            type: [String] 
        },
        description: { 
            type: String, 
            required: [true, "Full description is required"] 
        },
        category_id: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "categories",
            required: [true, "Category ID is required"] 
        },
        brand_id: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "brands", 
            required: [true, "Brand ID is required"] 
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const productModel = mongoose.model("products", DataSchema);

module.exports = productModel;