const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");

const DataSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, "Email address is required"],
            unique: true,
            lowercase: true,
            trim: true,
            validate: {
                validator: validator.isEmail,
                message: "Please enter a valid email address format",
            },
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
        },
        // Customer Details
        cus_name: { type: String },
        cus_add: { type: String },
        cus_city: { type: String },
        cus_country: { type: String },
        cus_fax: { type: String },
        cus_phone: { type: String },
        cus_postcode: { type: String },
        cus_state: { type: String },

        // Shipping Details
        ship_name: { type: String },
        ship_add: { type: String },
        ship_city: { type: String },
        ship_country: { type: String },
        ship_phone: { type: String },
        ship_postcode: { type: String },
        ship_state: { type: String },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

DataSchema.pre("save", async function () {
    // If the password hasn't been modified, skip hashing (e.g., when updating profile info)
    if (!this.isModified("password")) return;

    // Hash the password with a salt rounds value of 10
    this.password = await bcrypt.hash(this.password, 10);
});

const userModel = mongoose.model("users", DataSchema);

module.exports = userModel;