const mongoose = require("mongoose");
const reviewModel = require("../models/reviewModel.js");
const ObjectId = mongoose.Types.ObjectId;


// Review create
exports.createReview = async (req, res) => {
    try {
        const user_id = req.headers._id;
        const { product_id, invoice_id, des, rating } = req.body;

        if (!ObjectId.isValid(user_id) || !ObjectId.isValid(product_id) || !ObjectId.isValid(invoice_id)) {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        if (typeof rating !== "number" || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: "Rating must be a number between 1 and 5." });
        }

        const data = await reviewModel.findOneAndUpdate(
            { user_id, product_id, invoice_id },
            { user_id, product_id, invoice_id, des: des?.trim(), rating },
            { returnDocument: "after", upsert: true, runValidators: true } // <-- Updated here
        );

        return res.status(201).json({ success: true, message: "Review created successfully", data });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.toString(),
            message: "Something went wrong.",
        });
    }
};

// Review Get All with Pagination
exports.allReview = async (req, res) => {
    try {
        let page_no = Number(req.params.page_no);
        let per_page = Number(req.params.per_page);

        if (isNaN(page_no) || isNaN(per_page) || page_no < 1 || per_page < 1) {
            return res.status(400).json({ success: false, message: "Invalid pagination parameters." });
        }

        let skipRow = (page_no - 1) * per_page;

        let sortStage = { createdAt: -1 };

        let joinStageWithUser = {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
            },
        };

        let joinStageWithProduct = {
            $lookup: {
                from: "products",
                localField: "product_id",
                foreignField: "_id",
                as: "product",
            },
        };

        let unwindStageUser = { $unwind: "$user" };
        let unwindStageProduct = { $unwind: "$product" };

        let projectStage = {
            $project: {
                _id: 1,
                invoice_id: 1,
                product_id: 1,
                user_id: 1,
                createdAt: 1,
                des: 1,
                rating: 1,
                "user.cus_name": 1,
                "user.email": 1,
                "product.title": 1,
                "product.images": 1,
            },
        };

        let facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                data: [
                    { $sort: sortStage },
                    { $skip: skipRow },
                    { $limit: per_page },
                    joinStageWithUser,
                    unwindStageUser,
                    joinStageWithProduct,
                    unwindStageProduct,
                    projectStage,
                ],
            },
        };

        let data = await reviewModel.aggregate([facetStage]);

        return res.status(200).json({
            success: true,
            message: "Review fetched successfully",
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

//Get Review by single product
exports.allReviewByProducts = async (req, res) => {
    try {
        const { product_id: prodId } = req.params;

        if (!ObjectId.isValid(prodId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID format." });
        }

        let product_id = new ObjectId(prodId);

        let matchingStage = {
            $match: {
                product_id,
            },
        };

        let joinWithUser = {
            $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user",
            },
        };

        let unwindUseStage = {
            $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
        };

        let project = {
            $project: {
                createdAt: 1,
                updatedAt: 1,
                des: 1,
                rating: 1,
                "user.cus_name": 1,
                "user.email": 1,
            },
        };

        let data = await reviewModel.aggregate([
            matchingStage,
            joinWithUser,
            unwindUseStage,
            project,
        ]);

        return res.status(200).json({
            success: true,
            message: "Reviews fetched successfully",
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


// Review update single
exports.updateReview = async (req, res) => {
    try {
        let user_id = req.headers._id;
        const { product_id, invoice_id, des, rating } = req.body;
        const { id } = req.params;

        let data = await reviewModel.findOneAndUpdate(
            { _id: id, user_id },
            {
                product_id,
                invoice_id,
                des,
                rating,
            },
            { returnDocument: "after", runValidators: true }
        );

        if (!data) {
            return res.status(404).json({
                success: false,
                message: "Review not found or you are not authorized to update it.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Review updated successfully",
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