const express = require("express");
const rateLimit = require("express-rate-limit");
const adminController = require("../controllers/adminController.js");
const userController = require("../controllers/userController.js");
const authVerificaitonAdmin = require("../middlewares/authVerificaitonAdmin.js");
const authVerificationUser = require("../middlewares/authVerificationUser.js");
const productController = require("../controllers/productController.js");
const categoryController = require("../controllers/categoryController.js");
const reviewController = require("../controllers/reviewController.js");
const brandController = require("../controllers/brandController.js");
const cartController = require("../controllers/cartController.js");
const invoiceController = require("../controllers/invoiceController.js");
const fileUpload = require("../middlewares/fileUpload.js");
const fileController = require("../controllers/fileController.js");
const dashboardSummaryController = require("../controllers/dashboardSummaryController.js");
const router = express.Router();

// Strict rate limiter for login and registration routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many attempts from this IP, please try again after 15 minutes.",
    },
});


//For super admin
router.post("/admin-register", authLimiter, authVerificaitonAdmin, adminController.register);
router.post("/admin-login", authLimiter, adminController.login);
router.get("/admin", authVerificaitonAdmin, adminController.admin);
router.get("/admin-verify", authVerificaitonAdmin, adminController.adminVerify);
router.get("/admin-logout", authVerificaitonAdmin, adminController.logout);
router.put("/admin-update", authVerificaitonAdmin, adminController.update);

//For Users
router.post("/user-register", authLimiter, userController.register);
router.post("/user-login", authLimiter, userController.login);
router.get("/user", authVerificationUser, userController.user);
router.get("/user-verify", authVerificationUser, userController.userVerify);
router.get("/user-logout", authVerificationUser, userController.logout);
router.put("/user-update", authVerificationUser, userController.update);

//For Products
router.post("/create-product", authVerificaitonAdmin, productController.createProduct);
router.get(
    "/all-products/:category_id/:brand_id/:remark/:keyword/:per_page/:page_no",
    productController.allProduct
);
router.get("/single-product/:id", productController.singleProduct);
router.put("/update-product/:id", authVerificaitonAdmin, productController.updateProduct);
router.delete("/delete-product/:id", authVerificaitonAdmin, productController.deleteProduct);


//For Categories
router.post("/create-category", authVerificaitonAdmin, categoryController.createCategory);
router.get("/all-categories/:per_page/:page_no", categoryController.allCategory);
router.get("/single-category/:id", categoryController.singleCategory);
router.put("/update-category/:id", authVerificaitonAdmin, categoryController.updateCategory);
router.delete("/delete-category/:id", authVerificaitonAdmin, categoryController.deleteCategory);


//For Brands
router.post("/create-brand", authVerificaitonAdmin, brandController.createBrand);
router.get("/all-brand/:per_page/:page_no", brandController.allBrand);
router.get("/single-brand/:id", brandController.singleBrand);
router.put("/update-brand/:id", authVerificaitonAdmin, brandController.updateBrand);
router.delete("/delete-brand/:id", authVerificaitonAdmin, brandController.deleteBrand);


//For Review
router.post("/create-review", authVerificationUser, reviewController.createReview);
router.get("/all-review/:per_page/:page_no", authVerificaitonAdmin, reviewController.allReview);
router.get("/all-review-by-product/:product_id/", reviewController.allReviewByProducts);
router.put("/update-review/:id", authVerificationUser, reviewController.updateReview);

//For Cart
router.post("/create-cart", authVerificationUser, cartController.createCart);
router.get("/read-cart", authVerificationUser, cartController.readCart);
router.put(
    "/update-cart/:cart_id",
    authVerificationUser,
    cartController.updateCart
);
router.delete(
    "/delete-cart/:cart_id",
    authVerificationUser,
    cartController.deleteCart
);


//For Invoice and Payment
// ===================== // For user =========================
router.post("/create-invoice", authVerificationUser, invoiceController.createInvoice);
router.get(
    "/read-all-invoice-single-user/:page_no/:per_page",
    authVerificationUser,
    invoiceController.readAllInvoiceSingleUser
);
router.get("/read-single-invoice-single-user/:invoice_id", authVerificationUser, invoiceController.readSingleInvoiceSingleUser);
router.get("/read-invoice-product-list-single-user/:page_no/:per_page", authVerificationUser, invoiceController.readInvoiceProductListSingleUser);
router.post("/payment-success/:trx_id", invoiceController.paymentSuccess);
router.post("/payment-cancel/:trx_id", invoiceController.paymentCancel);
router.post("/payment-fail/:trx_id", invoiceController.paymentFail);
router.post("/payment-ipn", invoiceController.paymentIpn);
router.post("/payment-ipn/:trx_id", invoiceController.paymentIpn);


//===================== // For admin =========================
router.get("/all-order-list/:page_no/:per_page", authVerificaitonAdmin, invoiceController.allOrderList);
router.get("/export-csv", authVerificaitonAdmin, invoiceController.exportCSV);
router.put("/update-invoice", authVerificaitonAdmin, invoiceController.updateInvoice);


//===================== // For file upload =========================
router.post("/file-upload", authVerificaitonAdmin, fileUpload, fileController.fileUpload);
router.get("/get-file/:filename", fileController.getFile);
router.get("/all-file/:page_no/:per_page", authVerificaitonAdmin, fileController.allFile);
router.post("/file-remove", authVerificaitonAdmin, fileController.fileRemove);

//===================== // For dashboard summary =========================
router.get("/dashboard-summary", authVerificaitonAdmin, dashboardSummaryController.dashboardSummary);

module.exports = router;