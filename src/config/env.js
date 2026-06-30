require('dotenv').config({ quiet: true });

module.exports = {
    port: process.env.APP_PORT || 5000,
    env: process.env.NODE_ENV,

    // Database
    dbUri: process.env.DB_URI,
    db: process.env.MONGODB_URI,

    // JWT
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '24h',

    // Other
    apiKey: process.env.API_KEY,

    // OpenRouter
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
    openrouterSiteUrl: process.env.OPENROUTER_SITE_URL || '',
    openrouterSiteName: process.env.OPENROUTER_SITE_NAME || 'Court Ticket System',

    // Groq
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',

    // Google Gemini
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

    // Cerebras
    cerebrasApiKey: process.env.CEREBRAS_API_KEY,
    cerebrasModel: process.env.CEREBRAS_MODEL || 'llama-4-scout-17b-16e-instruct',

    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',

    // Mistral
    mistralApiKey: process.env.MISTRAL_API_KEY,
    mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',

    // Cohere
    cohereApiKey: process.env.COHERE_API_KEY,
    cohereModel: process.env.COHERE_MODEL || 'command-a',

    // Cloudflare Workers AI
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareModel:
        process.env.CLOUDFLARE_MODEL ||
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};