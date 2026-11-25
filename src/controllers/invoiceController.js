const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const invoiceModel = require("../models/invoiceModel.js");
const invoiceProductModel = require("../models/invoiceProductModel.js");
const cartModel = require("../models/cartModel.js");
const productModel = require("../models/productModel.js");
const ObjectId = mongoose.Types.ObjectId;
const userModel = require("../models/userModel.js");
const FormData = require("form-data");
const { Parser } = require("json2csv");
const axios = require("axios");
const {
    InventoryUnavailableError,
    completeValidatedPayment,
    getReservationTtlMs,
    releaseInvoiceReservation,
    reserveStockForCart,
} = require("../services/invoicePaymentLifecycle.js");
const {
    PaymentVerificationError,
    validateSslCommerzPayment,
    verifySslCommerzIpn,
} = require("../services/sslCommerzPayment.js");

const isSignedCallbackForTransaction = (body, tranId, allowedStatuses) =>
    verifySslCommerzIpn(body) &&
    String(body.tran_id || "").trim() === tranId &&
    allowedStatuses.includes(String(body.status || "").toUpperCase());

//Create Invoice
exports.createInvoice = async (req, res) => {
    let tran_id;

    try {
        const user_id = new ObjectId(req.headers._id);
        const cus_email = req.headers.email;

        const paymentSetting = {
            store_id: process.env.SSLCZ_STORE_ID,
            store_passwd: process.env.SSLCZ_STORE_PASSWD,
            currency: process.env.SSLCZ_CURRENCY || "BDT",
            success_url: process.env.SSLCZ_SUCCESS_URL,
            fail_url: process.env.SSLCZ_FAIL_URL,
            cancel_url: process.env.SSLCZ_CANCEL_URL,
            ipn_url: process.env.SSLCZ_IPN_URL,
            init_url: process.env.SSLCZ_INIT_URL,
            validation_url: process.env.SSLCZ_VALIDATION_URL,
        };
        const missingSettings = Object.entries(paymentSetting)
            .filter(([, value]) => !value)
            .map(([name]) => name);

        if (missingSettings.length) {
            console.error(
                "Incomplete SSLCommerz configuration:",
                missingSettings.join(", ")
            );
            return res.status(503).json({
                success: false,
                message: "Payment provider configuration is incomplete.",
            });
        }

        // =========== Step-1: Calculate total payable & vat =============
        const matchStage = { $match: { user_id } };
        const joinStageWithProduct = {
            $lookup: {
                from: "products",
                localField: "product_id",
                foreignField: "_id",
                as: "product",
            },
        };
        const unwindStage = { $unwind: "$product" };

        const cartProducts = await cartModel.aggregate([
            matchStage,
            joinStageWithProduct,
            unwindStage,
        ]);

        if (!cartProducts || cartProducts.length === 0) {
            return res.status(200).json({
                success: false,
                message: "Cart empty!",
            });
        }

        const totalAmount = Number(
            cartProducts
                .reduce((total, item) => {
                    const price = Number(
                        item.product.is_discount
                            ? item.product.discount_price
                            : item.product.price
                    );
                    const quantity = Number(item.qty);

                    if (
                        !Number.isFinite(price) ||
                        !Number.isInteger(quantity) ||
                        quantity < 1
                    ) {
                        throw new Error("Cart contains an invalid product price or quantity.");
                    }

                    return total + quantity * price;
                }, 0)
                .toFixed(2)
        );
        const vat = Number((totalAmount * 0.15).toFixed(2));
        const shipping = 75;
        const totalPayable = Number((totalAmount + vat + shipping).toFixed(2));

        // =========== Step-2: Prepare customer details & shipping details =============
        const user = await userModel.findById(user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const requiredFields = [
            user.cus_add, user.cus_city, user.cus_country, user.cus_name,
            user.cus_phone, user.cus_postcode, user.ship_add, user.ship_city,
            user.ship_country, user.ship_name, user.ship_phone, user.ship_postcode
        ];

        if (requiredFields.some((v) => !v)) {
            return res.status(200).json({
                success: false,
                message: "Please go to dashboard & complete your profile information data!",
            });
        }

        const cus_details = {
            Name: user?.cus_name,
            Email: cus_email,
            Address: user?.cus_add,
            Phone: user?.cus_phone,
        };
        const ship_details = {
            Name: user?.ship_name,
            City: user?.ship_city,
            Address: user?.ship_add,
            Phone: user?.ship_phone,
        };

        // =========== Step-3: Transaction & other's ID =============
        tran_id = `tra-${randomUUID().replace(/-/g, "").slice(0, 25)}`;
        const session = await mongoose.startSession();
        let createInvoice;

        try {
            await session.withTransaction(async () => {
                await reserveStockForCart(cartProducts, session);

                [createInvoice] = await invoiceModel.create(
                    [{
                        user_id,
                        payable: totalPayable,
                        cus_details,
                        ship_details,
                        tran_id,
                        vat,
                        total: totalAmount,
                        stock_reserved: true,
                        reservation_expires_at: new Date(
                            Date.now() + getReservationTtlMs()
                        ),
                    }],
                    { session }
                );

                await invoiceProductModel.insertMany(
                    cartProducts.map((item) => ({
                        user_id,
                        product_name: item?.product?.title || item?.product_name,
                        product_id: item?.product_id,
                        invoice_id: createInvoice._id,
                        cart_id: item._id,
                        qty: item.qty,
                        price: item?.product?.is_discount === true
                            ? item?.product?.discount_price
                            : item?.product?.price,
                        color: item.color,
                        size: item.size,
                    })),
                    { session }
                );
            });
        } finally {
            await session.endSession();
        }

        // =========== Prepare SSL Payment =============
        const form = new FormData();
        form.append("store_id", paymentSetting.store_id);
        form.append("store_passwd", paymentSetting.store_passwd);
        form.append("total_amount", totalPayable.toFixed(2));
        form.append("currency", paymentSetting.currency);
        form.append("tran_id", tran_id);
        form.append("success_url", `${paymentSetting.success_url}/${tran_id}`);
        form.append("fail_url", `${paymentSetting.fail_url}/${tran_id}`);
        form.append("cancel_url", `${paymentSetting.cancel_url}/${tran_id}`);
        form.append("ipn_url", `${paymentSetting.ipn_url}/${tran_id}`);

        // Customer Information
        form.append("cus_name", user?.cus_name);
        form.append("cus_email", cus_email);
        form.append("cus_add1", user?.cus_add);
        form.append("cus_add2", user?.cus_add);
        form.append("cus_city", user?.cus_city);
        form.append("cus_state", user?.cus_state);
        form.append("cus_postcode", user?.cus_postcode);
        form.append("cus_country", user?.cus_country);
        form.append("cus_phone", user?.cus_phone);

        // Shipment Information
        form.append("shipping_method", "YES");
        form.append("ship_name", user?.ship_name);
        form.append("ship_add1", user?.ship_add);
        form.append("ship_add2", user?.ship_add);
        form.append("ship_city", user?.ship_city);
        form.append("ship_state", user?.ship_state);
        form.append("ship_country", user?.ship_country);
        form.append("ship_postcode", user?.ship_postcode);
        form.append("ship_phone", user?.ship_phone);

        // Product Information
        form.append("product_name", "E-commerce Products");
        form.append("product_category", "General");
        form.append("product_profile", "general");
        form.append("product_amount", totalAmount.toFixed(2));

        const sslResponse = await axios.post(paymentSetting.init_url, form, {
            headers: form.getHeaders(),
            timeout: 15000,
        });

        if (
            String(sslResponse.data?.status || "").toUpperCase() !== "SUCCESS" ||
            !sslResponse.data?.GatewayPageURL
        ) {
            await releaseInvoiceReservation(tran_id, "fail");
            return res.status(502).json({
                success: false,
                message: "The payment provider could not start a checkout session.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice and payment session created successfully",
            data: sslResponse.data,
        });
    } catch (error) {
        if (tran_id) {
            try {
                await releaseInvoiceReservation(tran_id, "fail");
            } catch (releaseError) {
                console.error(
                    "Could not release checkout reservation:",
                    releaseError.message
                );
            }
        }

        if (error instanceof InventoryUnavailableError) {
            return res.status(409).json({
                success: false,
                message: "One or more products no longer have enough stock.",
            });
        }

        console.error("Invoice creation failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};


// Read all invoice single user
exports.readAllInvoiceSingleUser = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.headers._id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID.",
            });
        }

        let user_id = new mongoose.Types.ObjectId(req.headers._id);
        let page_no = Math.max(1, Number.parseInt(req.params.page_no, 10) || 1);
        let per_page = Math.min(100, Math.max(1, Number.parseInt(req.params.per_page, 10) || 10));
        let skipRow = (page_no - 1) * per_page;

        let matchStage = {
            $match: {
                user_id: user_id,
            },
        };
        let sortStage = { createdAt: -1 };

        let facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                data: [{ $sort: sortStage }, { $skip: skipRow }, { $limit: per_page }],
            },
        };

        let products = await invoiceModel.aggregate([matchStage, facetStage]);

        return res.status(200).json({
            success: true,
            message: "Invoice fetched successfully",
            data: products[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Something went wrong.",
        });
    }
};


// Read single invoice single user
exports.readSingleInvoiceSingleUser = async (req, res) => {
    try {
        if (
            !mongoose.Types.ObjectId.isValid(req.params.invoice_id) ||
            !mongoose.Types.ObjectId.isValid(req.headers._id)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid invoice or user ID.",
            });
        }

        let invoice_id = new mongoose.Types.ObjectId(req.params.invoice_id);
        let user_id = new mongoose.Types.ObjectId(req.headers._id);

        let matchStage = {
            $match: {
                _id: invoice_id,
                user_id: user_id,
            },
        };

        let joinStageWithInvoiceProduct = {
            $lookup: {
                from: "invoicesproducts",
                localField: "_id",
                foreignField: "invoice_id",
                as: "invoiceProducts",
            },
        };

        let data = await invoiceModel.aggregate([
            matchStage,
            joinStageWithInvoiceProduct,
        ]);

        if (!data.length) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invoice fetched successfully",
            data: data[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Something went wrong.",
        });
    }
};


// Read invoice product list single user
exports.readInvoiceProductListSingleUser = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.headers._id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID.",
            });
        }

        let user_id = new mongoose.Types.ObjectId(req.headers._id);
        let page_no = Math.max(1, Number.parseInt(req.params.page_no, 10) || 1);
        let per_page = Math.min(100, Math.max(1, Number.parseInt(req.params.per_page, 10) || 10));
        let skipRow = (page_no - 1) * per_page;

        let matchStage = {
            $match: {
                user_id: user_id,
            },
        };
        let sortStage = { createdAt: -1 };

        let joinStageWithProduct = {
            $lookup: {
                from: "products",
                localField: "product_id",
                foreignField: "_id",
                as: "product",
            },
        };

        let unwindStage = {
            $unwind: {
                path: "$product",
                preserveNullAndEmptyArrays: true,
            },
        };

        let projectionStage = {
            $project: {
                product_name: 1,
                qty: 1,
                price: 1,
                color: 1,
                size: 1,
                createdAt: 1,
                "product._id": 1,
                "product.images": 1,
            },
        };

        let facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                products: [
                    { $sort: sortStage },
                    { $skip: skipRow },
                    { $limit: per_page },
                    joinStageWithProduct,
                    unwindStage,
                    projectionStage,
                ],
            },
        };

        let products = await invoiceProductModel.aggregate([
            matchStage,
            joinStageWithProduct,
            facetStage,
        ]);

        return res.status(200).json({
            success: true,
            message: "Invoice product list fetched successfully",
            data: products[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Something went wrong.",
        });
    }
};



// payment-success
exports.paymentSuccess = async (req, res) => {
    try {
        const trx_id = String(req.params.trx_id || "").trim();
        if (!trx_id || trx_id.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID.",
            });
        }

        if (!verifySslCommerzIpn(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Invalid SSLCommerz notification signature.",
            });
        }

        const callbackTranId = String(req.body?.tran_id || "").trim();
        if (callbackTranId && callbackTranId !== trx_id) {
            return res.status(400).json({
                success: false,
                message: "Payment transaction ID does not match.",
            });
        }

        const invoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        const val_id = String(req.body?.val_id || req.query?.val_id || "").trim();
        await validateSslCommerzPayment(invoice, val_id);

        const result = await completeValidatedPayment(trx_id, val_id);
        if (result === "not_found") {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        if (result === "refund_required") {
            const failUrl = process.env.PAYMENT_FAIL_URL || "/payment-fail";
            return res.redirect(
                `${failUrl}${failUrl.includes("?") ? "&" : "?"}reason=refund_required`
            );
        }

        return res.redirect(
            process.env.PAYMENT_SUCCESS_URL || "/cart-thank-you"
        );
    } catch (error) {
        if (error instanceof PaymentVerificationError) {
            console.warn("Payment callback was not verified:", error.message);
            const failUrl = process.env.PAYMENT_FAIL_URL || "/payment-fail";
            return res.redirect(
                `${failUrl}${failUrl.includes("?") ? "&" : "?"}reason=verification_pending`
            );
        }

        console.error("Payment success callback failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};



// Payment cancel
exports.paymentCancel = async (req, res) => {
    try {
        const trx_id = String(req.params.trx_id || "").trim();
        if (!trx_id || trx_id.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID.",
            });
        }

        const cancelUrl = process.env.PAYMENT_CANCEL_URL || "/payment-cancel";
        if (
            !isSignedCallbackForTransaction(req.body, trx_id, [
                "CANCEL",
                "CANCELLED",
            ])
        ) {
            return res.redirect(
                `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}reason=verification_pending`
            );
        }

        const invoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        if (invoice.payment_status === "pending") {
            await releaseInvoiceReservation(trx_id, "cancel");
        }

        const latestInvoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (latestInvoice?.payment_status === "success") {
            return res.redirect(
                process.env.PAYMENT_SUCCESS_URL || "/cart-thank-you"
            );
        }

        return res.redirect(cancelUrl);
    } catch (error) {
        console.error("Payment cancellation callback failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};


// Payment fail
exports.paymentFail = async (req, res) => {
    try {
        const trx_id = String(req.params.trx_id || "").trim();
        if (!trx_id || trx_id.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID.",
            });
        }

        const failUrl = process.env.PAYMENT_FAIL_URL || "/payment-fail";
        if (
            !isSignedCallbackForTransaction(req.body, trx_id, [
                "FAILED",
                "EXPIRED",
                "UNATTEMPTED",
            ])
        ) {
            return res.redirect(
                `${failUrl}${failUrl.includes("?") ? "&" : "?"}reason=verification_pending`
            );
        }

        const invoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        if (invoice.payment_status === "pending") {
            await releaseInvoiceReservation(trx_id, "fail");
        }

        const latestInvoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (latestInvoice?.payment_status === "success") {
            return res.redirect(
                process.env.PAYMENT_SUCCESS_URL || "/cart-thank-you"
            );
        }

        return res.redirect(failUrl);
    } catch (error) {
        console.error("Payment failure callback failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};



// payment-ipn
exports.paymentIpn = async (req, res) => {
    try {
        const trx_id = String(req.params.trx_id || req.body?.tran_id || "").trim();
        if (!trx_id || trx_id.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID.",
            });
        }

        const callbackTranId = String(req.body?.tran_id || "").trim();
        if (callbackTranId && callbackTranId !== trx_id) {
            return res.status(400).json({
                success: false,
                message: "Payment transaction ID does not match.",
            });
        }

        const invoice = await invoiceModel.findOne({ tran_id: trx_id });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found.",
            });
        }

        const status = String(req.body?.status || "").toUpperCase();
        const val_id = String(req.body?.val_id || "").trim();

        if (status === "VALID" || status === "VALIDATED") {
            await validateSslCommerzPayment(invoice, val_id);
            const result = await completeValidatedPayment(trx_id, val_id);

            if (result === "not_found") {
                return res.status(404).json({
                    success: false,
                    message: "Invoice not found.",
                });
            }
        } else if (
            ["FAILED", "CANCEL", "CANCELLED", "EXPIRED", "UNATTEMPTED"].includes(
                status
            )
        ) {
            const nextStatus =
                status === "CANCEL" || status === "CANCELLED"
                    ? "cancel"
                    : status === "EXPIRED"
                      ? "expired"
                      : "fail";
            await releaseInvoiceReservation(
                trx_id,
                nextStatus
            );
        } else {
            return res.status(400).json({
                success: false,
                message: "Unsupported payment notification status.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "IPN processed successfully.",
        });
    } catch (error) {
        console.error("Payment IPN processing failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};



// ===================== // For admin =========================
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const parseDateFilter = (rawValue, isEndOfDay = false) => {
    if (!rawValue) return null;
    const trimmed = String(rawValue).trim();
    const formatted = DATE_ONLY_RE.test(trimmed)
        ? `${trimmed}${isEndOfDay ? "T23:59:59.999" : "T00:00:00"}`
        : trimmed;
    const parsed = new Date(formatted);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// all Order List by date filter
exports.allOrderList = async (req, res) => {
    try {
        const per_page = Math.max(1, Math.min(Number(req.params.page_no) || 6, 100));
        const page_no = Math.max(1, Math.min(Number(req.params.per_page) || 1, 100000));
        const skipRow = (page_no - 1) * per_page;
        // Optional date filter
        const { from, to } = req.query;

        // Simple match: if no date, show all invoices
        const fromDate = parseDateFilter(from, false) || new Date("1970-01-01T00:00:00");
        const toDate = parseDateFilter(to, true) || new Date();

        if (fromDate > toDate) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range: 'from' date cannot be after 'to' date.",
            });
        }

        const matchStage = {
            createdAt: {
                $gte: fromDate,
                $lte: toDate,
            },
        };

        // $facet for total count + paginated data
        const facetStage = {
            $facet: {
                totalCount: [{ $count: "count" }],
                products: [
                    { $sort: { createdAt: -1 } },
                    { $skip: skipRow },
                    { $limit: per_page },
                    {
                        $lookup: {
                            from: "invoicesproducts",
                            localField: "_id",
                            foreignField: "invoice_id",
                            as: "product",
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            user_id: 1,
                            payable: 1,
                            cus_details: 1,
                            ship_details: 1,
                            tran_id: 1,
                            val_id: 1,
                            deliver_status: 1,
                            payment_status: 1,
                            vat: 1,
                            total: 1,
                            createdAt: 1,
                            "product.product_id": 1,
                            "product.product_name": 1,
                            "product.qty": 1,
                            "product.price": 1,
                            "product.color": 1,
                            "product.size": 1,
                        },
                    },
                ],
            },
        };

        // Aggregate pipeline
        const products = await invoiceModel.aggregate([
            { $match: matchStage }, // filter by date
            facetStage, // count + paginated products
        ]);

        return res.status(200).json({
            success: true,
            message: "Invoices fetched successfully",
            data: products[0],
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
            error: error.toString(),
        });
    }
};



//Export CSV
exports.exportCSV = async (req, res) => {
    try {
        const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
        const to = typeof req.query.to === "string" ? req.query.to.trim() : "";

        // Simple match: if no date, show all invoices
        const fromDate = from
            ? new Date(`${from}T00:00:00`)
            : new Date("1970-01-01T00:00:00");
        const toDate = to ? new Date(`${to}T23:59:59.999`) : new Date();

        if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
            return res.status(400).json({
                success: false,
                message: "Invalid date filter range.",
            });
        }

        const matchStage = {
            createdAt: {
                $gte: fromDate,
                $lte: toDate,
            },
        };

        // Get invoices
        const data = await invoiceModel
            .find(matchStage)
            .sort({ createdAt: -1 })
            .limit(5000)
            .lean();

        // Select columns for CSV
        const fields = [
            "_id",
            "user_id",
            "payable",
            "deliver_status",
            "payment_status",
            "total",
            "vat",
            "createdAt",
        ];

        // Convert to CSV
        const parser = new Parser({ fields });
        const csv = parser.parse(data);

        // Send file
        res.set({
            "Content-Type": "text/csv; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        });
        res.attachment("invoices.csv");
        return res.status(200).send(csv);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
            error: error.toString(),
        });
    }
};



// Update invoice
exports.updateInvoice = async (req, res) => {
    try {
        const { _id, user_id, deliver_status } = req.body;

        if (
            !mongoose.Types.ObjectId.isValid(_id) ||
            !mongoose.Types.ObjectId.isValid(user_id) ||
            !["delivered", "cancel"].includes(deliver_status)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid invoice update.",
            });
        }

        const checkInvoice = await invoiceModel.findOne({ _id, user_id });
        if (!checkInvoice) {
            return res.status(404).json({
                success: false,
                message: "Invoice not found!",
            });
        }

        // Step 2: Prevent multiple updates
        if (checkInvoice.deliver_status === "delivered") {
            return res.status(200).json({
                success: false,
                message: "Product already delivered!",
            });
        }
        if (checkInvoice.deliver_status === "cancel") {
            return res.status(200).json({
                success: false,
                message: "Product already canceled!",
            });
        }

        if (deliver_status === "delivered") {
            if (checkInvoice.payment_status !== "success") {
                return res.status(200).json({
                    success: false,
                    message: "Cannot deliver because payment was not successful!",
                });
            }

            const data = await invoiceModel.findOneAndUpdate(
                {
                    _id,
                    user_id,
                    payment_status: "success",
                    deliver_status: { $nin: ["delivered", "cancel"] },
                },
                { $set: { deliver_status: "delivered" } },
                { returnDocument: "after" }
            );

            return res.status(200).json({
                success: Boolean(data),
                message: data
                    ? "Product delivered successfully!"
                    : "Invoice status changed before the update could be applied.",
                data,
            });
        }

        if (checkInvoice.payment_status === "success") {
            return res.status(200).json({
                success: false,
                message: "Payment is successful. This order cannot be canceled here.",
            });
        }

        if (checkInvoice.payment_status === "pending") {
            await releaseInvoiceReservation(checkInvoice.tran_id, "cancel");
        }

        const data = await invoiceModel.findOneAndUpdate(
            {
                _id,
                user_id,
                payment_status: { $ne: "success" },
                deliver_status: { $nin: ["delivered", "cancel"] },
            },
            { $set: { deliver_status: "cancel" } },
            { returnDocument: "after" }
        );

        if (!data) {
            const latestInvoice = await invoiceModel.findById(_id);
            return res.status(409).json({
                success: false,
                message:
                    latestInvoice?.payment_status === "success"
                        ? "Payment was confirmed before the order could be canceled."
                        : "Invoice status changed before the update could be applied.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Unpaid order canceled. Any stock reservation was released.",
            data,
        });
    } catch (error) {
        console.error("Invoice update failed:", error.message);
        return res.status(500).json({
            success: false,
            message: "Something went wrong.",
        });
    }
};