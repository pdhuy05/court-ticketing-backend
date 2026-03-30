const mongoose = require("mongoose");
const env = require("./env")

const connectDB = async () => {
    try {
        await mongoose.connect(env.db);
        console.log("Connect OK")
    } catch (error) {
        console.error("Connect Error:", error);
        process.exit(1);
    }
}

module.exports = connectDB;