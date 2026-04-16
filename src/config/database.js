const mongoose = require("mongoose");
const env = require("./env");
const Ticket = require("../models/ticket.model");
const CounterSequence = require("../models/counterSequence.model");

const connectDB = async () => {
try {
await mongoose.connect(env.db);
await Ticket.syncIndexes();
await CounterSequence.syncIndexes();

console.log(`
\x1b[42m\x1b[30m ✓ \x1b[0m \x1b[36mMongoDB\x1b[0m: Kết nối thành công!
\x1b[90m  ├─ Host: \x1b[0m${mongoose.connection.host}
\x1b[90m  ├─ Port: \x1b[0m${mongoose.connection.port}
\x1b[90m  └─ Database: \x1b[0m\x1b[33m${mongoose.connection.name}\x1b[0m
`);
} catch (error) {
console.error(`
\x1b[41m\x1b[37m ✗ \x1b[0m \x1b[31mMongoDB\x1b[0m: Kết nối thất bại!
\x1b[90m  └─ Lỗi: \x1b[0m${error.message}
`);
process.exit(1);
}
};

module.exports = connectDB;
