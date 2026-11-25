const userModel = require("../models/userModel.js");
const productModel = require("../models/productModel.js");
const invoiceModel = require("../models/invoiceModel.js");
const reviewModel = require("../models/reviewModel.js");
const categoryModel = require("../models/categoryModel.js");
const brandModel = require("../models/brandModel.js");


//Dashboard Summary
exports.dashboardSummary = async (req, res) => {
    try {
        const [
            totalUsers,
            totalProducts,
            totalOrders,
            totalReviews,
            totalCategories,
            totalBrands,
            pendingDeliver,
            deliveredOrders,
            canceledOrders,
            totalIncomeAgg,
        ] = await Promise.all([
            userModel.countDocuments(),
            productModel.countDocuments(),
            invoiceModel.countDocuments(),
            reviewModel.countDocuments(),
            categoryModel.countDocuments(),
            brandModel.countDocuments(),
            invoiceModel.countDocuments({ deliver_status: "pending" }),
            invoiceModel.countDocuments({ deliver_status: "delivered" }),
            invoiceModel.countDocuments({ deliver_status: "cancel" }),
            invoiceModel.aggregate([
                { $match: { payment_status: "success" } },
                { $group: { _id: null, total: { $sum: { $toDouble: { $ifNull: ["$payable", 0] } } } } },
            ]),
        ]);

        const totalIncome = totalIncomeAgg[0]?.total ?? 0;

        return res.status(200).json({
            success: true,
            message: "Dashboard summary fetched successfully",
            data: {
                totalUsers,
                totalProducts,
                totalOrders,
                totalIncome,
                pendingDeliver,
                deliveredOrders,
                canceledOrders,
                totalReviews,
                totalCategories,
                totalBrands,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
            error: error.message,
        });
    }
};