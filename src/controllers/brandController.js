const mongoose = require("mongoose");
const brandModel = require("../models/brandModel.js");
const ObjectId = require("mongoose").Types.ObjectId;
const productModel = require("../models/productModel.js");


//Create Brand
exports.createBrand = async (req, res) => {
    try {
        const { brand_name, brand_img } = req.body;

        if (!brand_name?.trim() || !brand_img?.trim() || typeof brand_name !== "string" || typeof brand_img !== "string") {
            return res.status(400).json({
                success: false,
                message: "Brand name and image are required.",
            });
        }

        const cleanName = brand_name.trim();
        const existingBrand = await brandModel.findOne({
            brand_name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        });

        if (existingBrand) {
            return res.status(409).json({
                success: false,
                message: "Brand already exists.",
            });
        }

        const data = await brandModel.create({
            brand_name: cleanName,
            brand_img: brand_img.trim(),
        });

        return res.status(201).json({
            success: true,
            message: "Brand created successfully",
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

//Get all Brands with pagination
exports.allBrand = async (req, res) => {
    try {
        const page_no = Math.max(1, parseInt(req.params.page_no, 10) || 1);
        const per_page = Math.min(100, Math.max(1, parseInt(req.params.per_page, 10) || 10));

        const skipRow = (page_no - 1) * per_page;

        const sortStage = { createdAt: -1 };
        const joinWithProduct = {
            $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "brand_id",
                pipeline: [{ $count: "count" }],
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
                brands: [
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

        const brands = await brandModel.aggregate([facetStage]);

        return res.status(200).json({
            success: true,
            message: "Brands fetched successfully",
            data: brands[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};


//Get single Brand 
exports.singleBrand = async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID.",
            });
        }

        const data = await brandModel.findById(id).lean();

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Brand not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Brand fetched successfully",
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

// Update Brand
exports.updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { brand_name, brand_img } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid brand ID." });
        }

        let data = await brandModel.findByIdAndUpdate(
            id,
            {
                ...(brand_name?.trim() && { brand_name: brand_name.trim() }),
                ...(brand_img?.trim() && { brand_img: brand_img.trim() }),
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!data) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }

        return res.status(200).json({
            success: true,
            message: "Brand updated successfully",
            data,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: "Brand name already exists." });
        }
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};
//Delete Brand
exports.deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        // find product with this brand id
        let products = await productModel.find({ brand_id: id });
        if (products.length > 0) {
            return res.status(200).json({
                success: false,
                message: "Please delete all products with this brand first.",
            });
        }

        await brandModel.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: "Brand deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};