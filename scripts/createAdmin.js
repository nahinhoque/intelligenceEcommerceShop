require("dotenv").config();

const mongoose = require("mongoose");
const readline = require("readline");
const { stdin, stdout } = require("process");
const adminModel = require("../src/models/adminModel.js");

const ask = (question) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: stdin, output: stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

const askHidden = (question) =>
    new Promise((resolve, reject) => {
        if (!stdin.isTTY) {
            reject(new Error("Admin creation requires an interactive terminal."));
            return;
        }

        const wasRaw = stdin.isRaw;
        let answer = "";

        const cleanup = () => {
            stdin.removeListener("data", onData);
            stdin.setRawMode(wasRaw);
            stdin.pause();
            stdout.write("\n");
        };

        const onData = (chunk) => {
            for (const character of chunk.toString()) {
                if (character === "\u0003") {
                    cleanup();
                    reject(new Error("Admin creation cancelled."));
                    return;
                }

                if (character === "\r" || character === "\n") {
                    cleanup();
                    resolve(answer);
                    return;
                }

                if (character === "\u007f" || character === "\b") {
                    answer = answer.slice(0, -1);
                    continue;
                }

                if (character >= " ") {
                    answer += character;
                }
            }
        };

        stdout.write(question);
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
    });

const createAdmin = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required.");
    }

    const email = (await ask("Admin email: ")).toLowerCase();
    const password = await askHidden("Admin password (input hidden): ");
    const confirmation = await askHidden("Confirm password (input hidden): ");

    if (password !== confirmation) {
        throw new Error("Passwords do not match.");
    }

    await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
    });

    const existingAdmin = await adminModel.findOne({});
    if (existingAdmin) {
        throw new Error(
            "An admin account already exists. This command only bootstraps the first admin."
        );
    }

    if (password.length < 12) {
        throw new Error("The initial admin password must be at least 12 characters.");
    }

    const admin = await adminModel.create({ email, password });
    console.log("Created the initial admin account.");
};

createAdmin()
    .catch((error) => {
        console.error("Admin bootstrap failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
