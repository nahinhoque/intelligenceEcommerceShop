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
            minlength: [5, "Password must be at least 5 characters long"],
        },
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

const adminModel = mongoose.model("admins", DataSchema);

module.exports = adminModel;