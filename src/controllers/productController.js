const mongoose = require("mongoose");
const productModel = require("../models/productModel");
const ObjectId = mongoose.Types.ObjectId;

// Product create
exports.createProduct = async (req, res) => {
    try {
        const {
            title,
            images,
            sort_description,
            price,
            is_discount,
            discount_price,
            remark,
            stock,
            color,
            size,
            description,
            category_id,
            brand_id,
        } = req.body;

        if (
            (category_id && !ObjectId.isValid(category_id)) ||
            (brand_id && !ObjectId.isValid(brand_id))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid category_id or brand_id format.",
            });
        }

        if (is_discount && Number(discount_price) >= Number(price)) {
            return res.status(400).json({
                success: false,
                message: "The discount price must be smaller than the main price.",
            });
        }

        const data = await productModel.create({
            title,
            images,
            sort_description,
            price,
            is_discount,
            discount_price: is_discount ? discount_price : 0,
            remark,
            stock,
            color,
            size,
            description,
            category_id,
            brand_id,
        });

        return res.status(201).json({
            success: true,
            message: "Product created successfully",
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

// Get all products
exports.allProduct = async (req, res) => {
    try {
        const page_no = Math.max(1, parseInt(req.params.page_no, 10) || 1);
        const per_page = Math.min(100, Math.max(1, parseInt(req.params.per_page, 10) || 10));
        const { category_id, brand_id, remark, keyword } = req.params;

        const skipRow = (page_no - 1) * per_page;
        const sortStage = { createdAt: -1 };

        const matchQuery = {};

        if (category_id && category_id !== "0") {
            if (!ObjectId.isValid(category_id)) {
                return res.status(400).json({ success: false, message: "Invalid category_id format." });
            }
            matchQuery.category_id = new ObjectId(category_id);
        }

        if (brand_id && brand_id !== "0") {
            if (!ObjectId.isValid(brand_id)) {
                return res.status(400).json({ success: false, message: "Invalid brand_id format." });
            }
            matchQuery.brand_id = new ObjectId(brand_id);
        }

        if (remark && remark !== "0") {
            matchQuery.remark = String(remark).trim();
        }

        if (keyword && keyword !== "0") {
            // Escape regex special characters to prevent ReDoS attacks
            const safeKeyword = String(keyword).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            matchQuery.title = { $regex: safeKeyword, $options: "i" };
        }

        const MatchingStage = { $match: matchQuery };

        const joinWithCategory = {
            $lookup: {
                from: "categories",
                localField: "category_id",
                foreignField: "_id",
                as: "category",
            },
        };

        const facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                products: [
                    { $sort: sortStage },
                    { $skip: skipRow },
                    { $limit: per_page },
                    joinWithCategory,
                    {
                        $project: {
                            _id: 1,
                            category_id: 1,
                            brand_id: 1,
                            title: 1,
                            images: 1,
                            price: 1,
                            is_discount: 1,
                            discount_price: 1,
                            remark: 1,
                            stock: 1,
                            createdAt: 1,
                            "category.category_name": 1,
                        },
                    },
                ],
            },
        };

        const products = await productModel.aggregate([MatchingStage, facetStage]);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: products[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

//Get Single Product
exports.singleProduct = async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID format.",
            });
        }

        const id = new ObjectId(req.params.id);

        const matchStage = {
            $match: { _id: id },
        };

        const joinWithCategory = {
            $lookup: {
                from: "categories",
                localField: "category_id",
                foreignField: "_id",
                as: "category",
            },
        };

        const joinWithBrand = {
            $lookup: {
                from: "brands",
                localField: "brand_id",
                foreignField: "_id",
                as: "brand",
            },
        };

        const data = await productModel.aggregate([
            matchStage,
            joinWithCategory,
            joinWithBrand,
            { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
            { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
        ]);

        if (!data.length) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: data[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


//Product Update
exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            images,
            sort_description,
            price,
            is_discount,
            discount_price,
            remark,
            stock,
            color,
            size,
            description,
            category_id,
            brand_id,
        } = req.body;

        if (
            !ObjectId.isValid(id) ||
            (category_id && !ObjectId.isValid(category_id)) ||
            (brand_id && !ObjectId.isValid(brand_id))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid ID format.",
            });
        }

        if (price !== undefined || discount_price !== undefined || is_discount !== undefined) {
            const existingProduct = await productModel.findById(id).select("price is_discount discount_price");
            if (!existingProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found.",
                });
            }

            const finalPrice = price !== undefined ? Number(price) : existingProduct.price;
            const finalIsDiscount = is_discount !== undefined ? is_discount : existingProduct.is_discount;
            const finalDiscountPrice = discount_price !== undefined ? Number(discount_price) : existingProduct.discount_price;

            if (finalIsDiscount && finalDiscountPrice >= finalPrice) {
                return res.status(400).json({
                    success: false,
                    message: "The discount price must be smaller than the main price.",
                });
            }
        }

        const updateFields = {
            title,
            images,
            sort_description,
            price,
            is_discount,
            discount_price: is_discount === false ? 0 : discount_price,
            remark,
            stock,
            color,
            size,
            description,
            category_id,
            brand_id,
        };

        // Remove undefined keys so partial updates don't overwrite existing fields
        Object.keys(updateFields).forEach(
            (key) => updateFields[key] === undefined && delete updateFields[key]
        );

        const data = await productModel.findByIdAndUpdate(id, updateFields, {
            returnDocument: "after",
            runValidators: true,
        });

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product updated successfully",
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

//Product Delete
exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID format.",
            });
        }

        const data = await productModel.findByIdAndDelete(id);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};