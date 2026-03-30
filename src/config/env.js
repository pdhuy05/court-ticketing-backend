require('dotenv').config();

module.exports = {
    port: process.env.APP_PORT || 3000,
    env: process.env.NODE_ENV,
    dbUri: process.env.DB_URI,
    jwtSecret: process.env.JWT_SECRET,
    apiKey: process.env.API_KEY,
    db: process.env.MONGODB_URI
}