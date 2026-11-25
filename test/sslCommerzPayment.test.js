const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const axios = require("axios");
const {
    PaymentVerificationError,
    isVerifiedPayment,
    validateSslCommerzPayment,
    verifySslCommerzIpn,
} = require("../src/services/sslCommerzPayment.js");

const invoice = {
    tran_id: "tra-example",
    payable: 937.5,
};

const validResponse = {
    status: "VALID",
    tran_id: "tra-example",
    val_id: "val-example",
    amount: "937.50",
    currency: "BDT",
    currency_amount: "937.50",
    currency_type: "BDT",
};

const createSignedIpn = (values, password) => {
    const verifyKey = Object.keys(values).join(",");
    const signedValues = {
        ...values,
        store_passwd: crypto.createHash("md5").update(password).digest("hex"),
    };
    const hashString = Object.keys(signedValues)
        .sort()
        .map((key) => `${key}=${signedValues[key]}`)
        .join("&");
    const verifySign = crypto
        .createHash("md5")
        .update(hashString)
        .digest("hex");

    return {
        ...values,
        verify_key: verifyKey,
        verify_sign: verifySign,
    };
};

test("accepts a validated transaction matching invoice, amount, and currency", () => {
    assert.equal(
        isVerifiedPayment(validResponse, invoice, "val-example", "BDT"),
        true
    );
});

test("rejects mismatched transaction data", () => {
    for (const overrides of [
        { status: "FAILED" },
        { tran_id: "another-transaction" },
        { val_id: "another-validation" },
        { currency_amount: "937.49" },
        { currency_type: "USD" },
        { store_id: "another-store" },
    ]) {
        assert.equal(
            isVerifiedPayment(
                { ...validResponse, ...overrides },
                invoice,
                "val-example",
                "BDT"
            ),
            false
        );
    }
});

test("validates through SSLCommerz using configured credentials", async () => {
    const previousEnv = {
        SSLCZ_VALIDATION_URL: process.env.SSLCZ_VALIDATION_URL,
        SSLCZ_STORE_ID: process.env.SSLCZ_STORE_ID,
        SSLCZ_STORE_PASSWD: process.env.SSLCZ_STORE_PASSWD,
        SSLCZ_CURRENCY: process.env.SSLCZ_CURRENCY,
    };
    const originalGet = axios.get;
    let request;

    process.env.SSLCZ_VALIDATION_URL =
        "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";
    process.env.SSLCZ_STORE_ID = "test-store";
    process.env.SSLCZ_STORE_PASSWD = "test-secret";
    process.env.SSLCZ_CURRENCY = "BDT";
    axios.get = async (url, options) => {
        request = { url, options };
        return { data: validResponse };
    };

    try {
        const result = await validateSslCommerzPayment(invoice, "val-example");
        assert.equal(result, validResponse);
        assert.equal(request.url, process.env.SSLCZ_VALIDATION_URL);
        assert.equal(request.options.params.store_id, "test-store");
        assert.equal(request.options.params.store_passwd, "test-secret");
        assert.equal(request.options.params.val_id, "val-example");
    } finally {
        axios.get = originalGet;
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
});

test("does not accept an unreachable validation service as a successful payment", async () => {
    const previousEnv = {
        SSLCZ_VALIDATION_URL: process.env.SSLCZ_VALIDATION_URL,
        SSLCZ_STORE_ID: process.env.SSLCZ_STORE_ID,
        SSLCZ_STORE_PASSWD: process.env.SSLCZ_STORE_PASSWD,
    };
    const originalGet = axios.get;

    process.env.SSLCZ_VALIDATION_URL = "https://sandbox.sslcommerz.com/validator";
    process.env.SSLCZ_STORE_ID = "test-store";
    process.env.SSLCZ_STORE_PASSWD = "test-secret";
    axios.get = async () => {
        throw new Error("network error");
    };

    try {
        await assert.rejects(
            validateSslCommerzPayment(invoice, "val-example"),
            PaymentVerificationError
        );
    } finally {
        axios.get = originalGet;
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
});

test("authenticates IPN data and rejects tampered notifications", async () => {
    const previousEnv = {
        SSLCZ_STORE_ID: process.env.SSLCZ_STORE_ID,
        SSLCZ_STORE_PASSWD: process.env.SSLCZ_STORE_PASSWD,
    };
    process.env.SSLCZ_STORE_ID = "test-store";
    process.env.SSLCZ_STORE_PASSWD = "test-secret";

    const signedIpn = createSignedIpn(
        {
            tran_id: "tra-example",
            status: "VALID",
            store_id: "test-store",
            amount: "937.50",
            currency_type: "BDT",
        },
        "test-secret"
    );

    try {
        assert.equal(verifySslCommerzIpn(signedIpn), true);
        assert.equal(
            verifySslCommerzIpn({ ...signedIpn, status: "FAILED" }),
            false
        );
        assert.equal(
            verifySslCommerzIpn({ ...signedIpn, store_id: "another-store" }),
            false
        );
    } finally {
        for (const [key, value] of Object.entries(previousEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
});
