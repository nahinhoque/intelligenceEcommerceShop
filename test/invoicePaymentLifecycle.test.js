const test = require("node:test");
const assert = require("node:assert/strict");
const { getReservationTtlMs } = require("../src/services/invoicePaymentLifecycle.js");

const withTtlSetting = async (value, callback) => {
    const previous = process.env.PAYMENT_RESERVATION_TTL_MINUTES;

    if (value === undefined) {
        delete process.env.PAYMENT_RESERVATION_TTL_MINUTES;
    } else {
        process.env.PAYMENT_RESERVATION_TTL_MINUTES = value;
    }

    try {
        await callback();
    } finally {
        if (previous === undefined) {
            delete process.env.PAYMENT_RESERVATION_TTL_MINUTES;
        } else {
            process.env.PAYMENT_RESERVATION_TTL_MINUTES = previous;
        }
    }
};

test("uses a 30-minute default and accepts the configured TTL limits", async () => {
    await withTtlSetting(undefined, async () => {
        assert.equal(getReservationTtlMs(), 30 * 60 * 1000);
    });

    await withTtlSetting("5", async () => {
        assert.equal(getReservationTtlMs(), 5 * 60 * 1000);
    });

    await withTtlSetting("1440", async () => {
        assert.equal(getReservationTtlMs(), 1440 * 60 * 1000);
    });
});

test("rejects invalid reservation TTL configuration", async () => {
    for (const value of ["4", "1441", "invalid"]) {
        await withTtlSetting(value, async () => {
            assert.throws(getReservationTtlMs, {
                message:
                    "PAYMENT_RESERVATION_TTL_MINUTES must be an integer between 5 and 1440.",
            });
        });
    }
});
