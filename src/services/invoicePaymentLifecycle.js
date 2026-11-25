const mongoose = require("mongoose");
const cartModel = require("../models/cartModel.js");
const invoiceModel = require("../models/invoiceModel.js");
const invoiceProductModel = require("../models/invoiceProductModel.js");
const productModel = require("../models/productModel.js");

class InventoryUnavailableError extends Error {}
class OrderAlreadyCancelledError extends Error {}

const groupQuantities = (items) => {
    const quantities = new Map();

    for (const item of items) {
        const productId = String(item.product_id);
        const quantity = Number(item.qty);

        if (!mongoose.Types.ObjectId.isValid(productId) || !Number.isInteger(quantity) || quantity < 1) {
            throw new Error("Invoice contains an invalid product or quantity.");
        }

        quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }

    return [...quantities.entries()];
};

const adjustStock = async (items, direction, session) => {
    for (const [productId, quantity] of groupQuantities(items)) {
        const filter = { _id: productId };
        if (direction < 0) {
            filter.stock = { $gte: quantity };
        }

        const result = await productModel.updateOne(
            filter,
            { $inc: { stock: direction * quantity } },
            { session }
        );

        if (result.matchedCount !== 1) {
            if (direction < 0) {
                throw new InventoryUnavailableError(
                    "One or more products no longer have enough stock."
                );
            }

            throw new Error(`Could not restore stock for product ${productId}.`);
        }
    }
};

const reserveStockForCart = (cartItems, session) =>
    adjustStock(cartItems, -1, session);

const reserveStockForInvoice = (invoiceItems, session) =>
    adjustStock(invoiceItems, -1, session);

const releaseInvoiceReservation = async (tranId, nextStatus) => {
    if (!["fail", "cancel", "expired"].includes(nextStatus)) {
        throw new Error("Invalid payment reservation transition.");
    }

    const session = await mongoose.startSession();
    let released = false;

    try {
        await session.withTransaction(async () => {
            released = false;
            const invoice = await invoiceModel
                .findOne({ tran_id: tranId })
                .session(session)
                .lean();

            if (!invoice || invoice.payment_status !== "pending") {
                return;
            }

            const isLegacyReservation =
                !Object.prototype.hasOwnProperty.call(invoice, "stock_reserved");
            if (invoice.stock_reserved || isLegacyReservation) {
                const items = await invoiceProductModel
                    .find({ invoice_id: invoice._id })
                    .session(session)
                    .lean();

                await adjustStock(items, 1, session);
            }

            const update = await invoiceModel.updateOne(
                { _id: invoice._id, payment_status: "pending" },
                {
                    $set: {
                        payment_status: nextStatus,
                        stock_reserved: false,
                        reservation_expires_at: null,
                    },
                },
                { session }
            );

            if (update.matchedCount !== 1) {
                throw new Error("Invoice changed while releasing its reservation.");
            }

            released = true;
        });
    } finally {
        await session.endSession();
    }

    return released;
};

const markRefundRequired = async (tranId, valId) => {
    const session = await mongoose.startSession();
    let result = "refund_required";

    try {
        await session.withTransaction(async () => {
            const invoice = await invoiceModel
                .findOne({ tran_id: tranId })
                .session(session);

            if (!invoice) {
                result = "not_found";
                return;
            }

            if (invoice.payment_status === "success") {
                result = "success";
                return;
            }

            if (invoice.payment_status !== "refund_required") {
                invoice.payment_status = "refund_required";
                invoice.val_id = valId;
                invoice.stock_reserved = false;
                invoice.reservation_expires_at = null;
                await invoice.save({ session });
            }
        });
    } finally {
        await session.endSession();
    }

    return result;
};

const completeValidatedPayment = async (tranId, valId) => {
    const session = await mongoose.startSession();
    let result = "success";

    try {
        await session.withTransaction(async () => {
            const invoice = await invoiceModel
                .findOne({ tran_id: tranId })
                .session(session)
                .lean();

            if (!invoice) {
                result = "not_found";
                return;
            }

            if (invoice.payment_status === "success") {
                result = "success";
                return;
            }

            if (invoice.payment_status === "refund_required") {
                result = "refund_required";
                return;
            }

            if (invoice.deliver_status === "cancel") {
                throw new OrderAlreadyCancelledError(
                    "The order was cancelled before payment was confirmed."
                );
            }

            const hasCheckoutReservation =
                invoice.payment_status === "pending" && invoice.stock_reserved;
            if (!hasCheckoutReservation) {
                const items = await invoiceProductModel
                    .find({ invoice_id: invoice._id })
                    .session(session)
                    .lean();

                const isLegacyReservation =
                    invoice.payment_status === "pending" &&
                    !Object.prototype.hasOwnProperty.call(invoice, "stock_reserved");

                if (!isLegacyReservation) {
                    await reserveStockForInvoice(items, session);
                }
            }

            const update = await invoiceModel.updateOne(
                {
                    _id: invoice._id,
                    payment_status: invoice.payment_status,
                    deliver_status: { $ne: "cancel" },
                },
                {
                    $set: {
                        payment_status: "success",
                        val_id: valId,
                        stock_reserved: false,
                        reservation_expires_at: null,
                    },
                },
                { session }
            );

            if (update.matchedCount !== 1) {
                throw new Error("Invoice changed while completing payment.");
            }

            const items = await invoiceProductModel
                .find({ invoice_id: invoice._id, cart_id: { $exists: true } })
                .session(session)
                .lean();

            for (const item of items) {
                await cartModel.deleteOne(
                    {
                        _id: item.cart_id,
                        user_id: invoice.user_id,
                        product_id: item.product_id,
                        qty: item.qty,
                        color: item.color,
                        size: item.size,
                    },
                    { session }
                );
            }
        });
    } catch (error) {
        if (
            !(error instanceof InventoryUnavailableError) &&
            !(error instanceof OrderAlreadyCancelledError)
        ) {
            throw error;
        }

        result = await markRefundRequired(tranId, valId);
    } finally {
        await session.endSession();
    }

    return result;
};

const getReservationTtlMs = () => {
    const rawMinutes = process.env.PAYMENT_RESERVATION_TTL_MINUTES;
    if (rawMinutes === undefined || rawMinutes.trim() === "") {
        return 30 * 60 * 1000;
    }

    const minutes = Number(rawMinutes);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
        throw new Error(
            "PAYMENT_RESERVATION_TTL_MINUTES must be an integer between 5 and 1440."
        );
    }

    return minutes * 60 * 1000;
};

const expirePendingReservations = async () => {
    const now = Date.now();
    const ttlMs = getReservationTtlMs();
    const invoices = await invoiceModel
        .find({
            payment_status: "pending",
            $or: [
                { reservation_expires_at: { $lte: new Date(now) } },
                {
                    reservation_expires_at: null,
                    createdAt: { $lte: new Date(now - ttlMs) },
                },
            ],
        })
        .sort({ createdAt: 1 })
        .limit(100)
        .select("tran_id createdAt reservation_expires_at")
        .lean();

    for (const invoice of invoices) {
        await releaseInvoiceReservation(invoice.tran_id, "expired");
    }
};

module.exports = {
    InventoryUnavailableError,
    OrderAlreadyCancelledError,
    completeValidatedPayment,
    expirePendingReservations,
    getReservationTtlMs,
    releaseInvoiceReservation,
    reserveStockForCart,
};
