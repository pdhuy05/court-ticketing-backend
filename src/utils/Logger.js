const logger = {
  success: (msg) => console.log(`\x1b[32m ${msg}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m ${msg}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m ${msg}\x1b[0m`),
  info: (msg) => console.log(`\x1b[36m ${msg}\x1b[0m`)
};

module.exports = logger;
