const http = require("http");
const config = require("./src/config/env");
const app = require("./src/app");
const database = require("./src/config/database");
const listEndpoints = require('express-list-endpoints');

database();

const server = http.createServer(app);


server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(listEndpoints(app));
});
