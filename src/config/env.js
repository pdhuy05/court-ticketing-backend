require('dotenv').config();

module.exports = {
    port: process.env.APP_PORT || 5000,
    env: process.env.NODE_ENV,
    dbUri: process.env.DB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '24h',
    apiKey: process.env.API_KEY,
    db: process.env.MONGODB_URI
}
