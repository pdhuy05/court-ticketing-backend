const format = (msg) => (typeof msg === 'object' && msg !== null ? JSON.stringify(msg) : String(msg));

const logger = {
  success: (msg) => console.log(`\x1b[32m ${format(msg)}\x1b[0m`),
  warning: (msg) => console.log(`\x1b[33m ${format(msg)}\x1b[0m`),
  error: (msg) => console.error(`\x1b[31m ${format(msg)}\x1b[0m`),
  info: (msg) => console.log(`\x1b[36m ${format(msg)}\x1b[0m`)
};

module.exports = logger;
