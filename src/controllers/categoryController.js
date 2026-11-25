const mongoose = require("mongoose");
const categoryModel = require("../models/categoryModel.js");
const ObjectId = mongoose.Types.ObjectId;
const productModel = require("../models/productModel.js");


// Create Category
exports.createCategory = async (req, res) => {
    try {
        const { category_name, category_img } = req.body;

        if (!category_name?.trim() || !category_img?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Category name and image are required.",
            });
        }

        const escapedName = category_name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const existingCategory = await categoryModel.findOne({
            category_name: { $regex: `^${escapedName}$`, $options: "i" },
        });

        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: "Category already exists.",
            });
        }

        const data = await categoryModel.create({
            category_name: category_name.trim(),
            category_img: category_img.trim(),
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Category already exists.",
            });
        }
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

//Get all Categories with pagination
exports.allCategory = async (req, res) => {
    try {
        const page_no = Math.max(1, parseInt(req.params.page_no, 10) || 1);
        const per_page = Math.min(100, Math.max(1, parseInt(req.params.per_page, 10) || 10));
        const skipRow = (page_no - 1) * per_page;

        const sortStage = { createdAt: -1 };

        const joinWithProduct = {
            $lookup: {
                from: "products",
                let: { categoryId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$category_id", "$$categoryId"] } } },
                    { $count: "count" },
                ],
                as: "products",
            },
        };

        const addProductCount = {
            $addFields: {
                totalProduct: { $ifNull: [{ $arrayElemAt: ["$products.count", 0] }, 0] },
            },
        };

        const facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                categories: [
                    { $sort: sortStage },
                    { $skip: skipRow },
                    { $limit: per_page },
                    joinWithProduct,
                    addProductCount,
                    {
                        $project: {
                            updatedAt: 0,
                            products: 0,
                        },
                    },
                ],
            },
        };

        const categories = await categoryModel.aggregate([facetStage]);

        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            data: categories[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


//Get single category 
exports.singleCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID format.",
            });
        }

        const data = await categoryModel.findById(id).lean();

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
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

//Single category update
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { category_name, category_img } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID.",
            });
        }

        const data = await categoryModel.findByIdAndUpdate(
            id,
            {
                ...(category_name && { category_name: category_name.trim() }),
                ...(category_img && { category_img: category_img.trim() }),
            },
            { new: true, runValidators: true }
        );

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
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

//Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID.",
            });
        }

        // Check if any product exists with this category id
        const products = await productModel.exists({ category_id: id });
        if (products) {
            return res.status(400).json({
                success: false,
                message: "Please delete all products with this category first.",
            });
        }

        const deletedCategory = await categoryModel.findByIdAndDelete(id);
        if (!deletedCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};