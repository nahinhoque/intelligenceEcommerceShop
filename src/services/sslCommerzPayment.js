const axios = require("axios");
const crypto = require("crypto");

class PaymentVerificationError extends Error {}

const toMinorUnits = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount)
        ? Math.round((amount + Number.EPSILON) * 100)
        : null;
};

const isVerifiedPayment = (validation, invoice, valId, currency) => {
    if (!validation || typeof validation !== "object") {
        return false;
    }

    const status = String(validation.status || "").toUpperCase();
    const responseCurrency = String(
        validation.currency_type || validation.currency || ""
    ).toUpperCase();
    const expectedCurrency = String(currency || "").toUpperCase();
    const responseAmount =
        validation.currency_amount !== undefined
            ? validation.currency_amount
            : validation.amount;

    return (
        ["VALID", "VALIDATED"].includes(status) &&
        String(validation.tran_id || "") === invoice.tran_id &&
        String(validation.val_id || "") === valId &&
        toMinorUnits(responseAmount) === toMinorUnits(invoice.payable) &&
        responseCurrency === expectedCurrency &&
        (!validation.store_id ||
            String(validation.store_id) === String(process.env.SSLCZ_STORE_ID))
    );
};

const verifySslCommerzIpn = (notification) => {
    const storeId = process.env.SSLCZ_STORE_ID;
    const storePassword = process.env.SSLCZ_STORE_PASSWD;

    if (!storeId || !storePassword) {
        throw new Error("SSLCommerz store credentials are not configured.");
    }

    if (
        !notification ||
        typeof notification !== "object" ||
        Array.isArray(notification) ||
        !String(notification.tran_id || "").trim() ||
        !String(notification.status || "").trim() ||
        String(notification.store_id || "") !== storeId
    ) {
        return false;
    }

    const verifyKey = String(notification.verify_key || "");
    const verifySign = String(notification.verify_sign || "");
    const keys = verifyKey.split(",").map((key) => key.trim()).filter(Boolean);

    if (
        !/^[a-f\d]{32}$/i.test(verifySign) ||
        !["status", "tran_id", "store_id"].every((key) => keys.includes(key)) ||
        keys.some((key) => ["verify_key", "verify_sign"].includes(key))
    ) {
        return false;
    }

    const signedValues = Object.create(null);
    for (const key of keys) {
        const value = notification[key];
        if (
            value !== undefined &&
            (typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean")
        ) {
            signedValues[key] = String(value);
        }
    }
    signedValues.store_passwd = crypto
        .createHash("md5")
        .update(storePassword)
        .digest("hex");

    const hashString = Object.keys(signedValues)
        .sort()
        .map((key) => `${key}=${signedValues[key]}`)
        .join("&");
    const expectedSign = crypto
        .createHash("md5")
        .update(hashString)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(expectedSign, "hex"),
        Buffer.from(verifySign, "hex")
    );
};

const validateSslCommerzPayment = async (invoice, valId) => {
    const validationUrl = process.env.SSLCZ_VALIDATION_URL;
    const storeId = process.env.SSLCZ_STORE_ID;
    const storePassword = process.env.SSLCZ_STORE_PASSWD;
    const currency = process.env.SSLCZ_CURRENCY || "BDT";

    if (!validationUrl || !storeId || !storePassword || !valId) {
        throw new PaymentVerificationError(
            "Payment verification is not configured or the validation ID is missing."
        );
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(validationUrl);
    } catch {
        throw new PaymentVerificationError("SSLCZ_VALIDATION_URL is invalid.");
    }

    if (parsedUrl.protocol !== "https:") {
        throw new PaymentVerificationError(
            "SSLCZ_VALIDATION_URL must use HTTPS."
        );
    }

    let response;
    try {
        response = await axios.get(parsedUrl.toString(), {
            params: {
                val_id: valId,
                store_id: storeId,
                store_passwd: storePassword,
                format: "json",
            },
            timeout: 10000,
        });
    } catch {
        throw new PaymentVerificationError(
            "Could not reach the SSLCommerz validation service."
        );
    }

    if (!isVerifiedPayment(response.data, invoice, valId, currency)) {
        throw new PaymentVerificationError(
            "SSLCommerz could not verify this transaction."
        );
    }

    return response.data;
};

module.exports = {
    PaymentVerificationError,
    isVerifiedPayment,
    validateSslCommerzPayment,
    verifySslCommerzIpn,
};
