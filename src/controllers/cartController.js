const mongoose = require("mongoose");
const cartModel = require("../models/cartModel.js");
const productModel = require("../models/productModel.js");
const ObjectId = mongoose.Types.ObjectId;


// Cart create
exports.createCart = async (req, res) => {
    try {
        const { product_id, product_name, color, qty, size } = req.body;
        let user_id = req.headers._id;

        if (!ObjectId.isValid(user_id) || !ObjectId.isValid(product_id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        // Find the stock products and get its price
        const product = await productModel.findById(product_id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        // Find existing cart item
        let existingCart = await cartModel.findOne({
            user_id,
            product_id,
            product_name,
            color,
            size,
        });

        // Calculate total quantity currently in carts for this product
        const carts = await cartModel.find({ product_id }).select("qty");
        let totalQty = carts.reduce((sum, item) => sum + item.qty, 0);

        if (existingCart) {
            totalQty -= existingCart.qty;
        }

        // Check stock limit
        if (product.stock < totalQty + qty) {
            return res.status(200).json({
                success: false,
                message: "You have added all the products in stock.",
            });
        }

        if (existingCart) {
            // For existing products (Update)
            let newReqBody = {
                user_id,
                product_id,
                product_name,
                color,
                size,
                price: product.price, // Included price from product model
                qty: parseInt(existingCart.qty) + parseInt(qty),
            };

            const updateData = await cartModel.updateOne(
                { _id: existingCart._id, user_id: existingCart.user_id },
                { $set: newReqBody }
            );

            return res.status(200).json({
                success: true,
                message: "Cart updated successfully.",
                updateData,
            });
        } else {
            // For new products (Create)
            const data = await cartModel.create({
                user_id,
                product_id,
                product_name,
                color,
                qty,
                size,
                price: product.price, // Included price from product model
            });

            return res.status(200).json({
                success: true,
                message: "Product added to cart successfully",
                data,
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


// cart read
exports.readCart = async (req, res) => {
    try {
        let user_id = new ObjectId(req.headers._id);

        let matchStage = { $match: { user_id } };

        let joinWithProduct = {
            $lookup: {
                from: "products",
                localField: "product_id",
                foreignField: "_id",
                as: "product",
            },
        };

        let unwindProductStage = {
            $unwind: { path: "$product", preserveNullAndEmptyArrays: true }
        };

        let joinWithBrand = {
            $lookup: {
                from: "brands",
                localField: "product.brand_id",
                foreignField: "_id",
                as: "brand",
            },
        };

        let joinWithCategory = {
            $lookup: {
                from: "categories",
                localField: "product.category_id",
                foreignField: "_id",
                as: "category",
            },
        };

        let unwindBrandStage = {
            $unwind: { path: "$brand", preserveNullAndEmptyArrays: true }
        };

        let unwindCategoryStage = {
            $unwind: { path: "$category", preserveNullAndEmptyArrays: true }
        };

        // Pure exclusion projection: hides unwanted metadata, keeping all IDs and timestamps visible
        let projectionStage = {
            $project: {
                "product.category_id": 0,
                "product.brand_id": 0,
                "product.createdAt": 0,
                "product.updatedAt": 0,
                "product.description": 0,
                "brand.createdAt": 0,
                "brand.updatedAt": 0,
                "category.createdAt": 0,
                "category.updatedAt": 0,
            },
        };

        const data = await cartModel.aggregate([
            matchStage,
            joinWithProduct,
            unwindProductStage,
            joinWithBrand,
            unwindBrandStage,
            joinWithCategory,
            unwindCategoryStage,
            projectionStage,
        ]);

        return res.status(200).json({
            success: true,
            message: "Cart fetched successfully",
            data,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


// cart update
exports.updateCart = async (req, res) => {
    try {
        const { product_id, qty, inc } = req.body;

        let user_id = new ObjectId(req.headers._id);
        let cart_id = new ObjectId(req.params.cart_id);
        let productIdObj = new ObjectId(product_id);

        // 1. Find the existing cart item to check current quantity if incrementing/decrementing
        let existingCart = await cartModel.findOne({ _id: cart_id, user_id: user_id });
        if (!existingCart) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found.",
            });
        }

        // 2. Fetch the product to verify existence and stock limits
        let product = await productModel.findById(productIdObj);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        // 3. Determine new quantity: 
        // If 'inc' is provided, smartly increment (+1) or decrement (-1) from current qty.
        // Otherwise, fall back to the explicit 'qty' passed in the request body.
        let currentQty = existingCart.qty || 1;
        let targetQty;

        if (inc !== undefined) {
            targetQty = inc ? currentQty + 1 : currentQty - 1;
        } else {
            targetQty = qty !== undefined ? qty : currentQty;
        }

        // Ensure quantity can never drop below 1
        if (targetQty < 1) {
            targetQty = 1;
        }

        // 4. Strict Stock Validation (Only check when increasing or setting a higher qty)
        if (product.stock !== undefined && targetQty > product.stock) {
            return res.status(200).json({
                success: false,
                message: `Only ${product.stock} items are available in stock.`,
            });
        }

        // 5. Perform the secure update in MongoDB
        const data = await cartModel.updateOne(
            { _id: cart_id, user_id: user_id },
            {
                $set: {
                    user_id,
                    product_id: productIdObj,
                    qty: targetQty
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: `Cart updated successfully. Action: ${inc !== undefined ? (inc ? "inc +" : "inc -") : "direct update"}`,
            data,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


// Delete cart
exports.deleteCart = async (req, res) => {
    try {
        let user_id = new ObjectId(req.headers._id);
        let cart_id = new ObjectId(req.params.cart_id);

        // 1. Check if the cart item exists and belongs to the authenticated user
        const existingCart = await cartModel.findOne({ _id: cart_id, user_id: user_id });
        if (!existingCart) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found or unauthorized.",
            });
        }

        // 2. Securely delete the cart item matching both cart ID and user ID
        const data = await cartModel.deleteOne({ _id: cart_id, user_id: user_id });

        return res.status(200).json({
            success: true,
            message: "Cart deleted successfully",
            data,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};