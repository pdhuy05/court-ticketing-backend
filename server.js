const http = require("http");
const config = require("./src/config/env");
const app = require("./src/app");
const database = require("./src/config/database");

database();

const server = http.createServer(app);

server.listen(config.port, () => {
console.log(`
\x1b[42m\x1b[30m ✓ \x1b[0m \x1b[36mServer\x1b[0m: Khởi động thành công!
\x1b[90m  ├─ URL: \x1b[0m\x1b[33mhttp://localhost:${config.port}\x1b[0m
\x1b[90m  ├─ Port: \x1b[0m${config.port}
\x1b[90m  ├─ Time: \x1b[0m${new Date().toLocaleString()}
\x1b[90m  └─ Developer: \x1b[0m\x1b[35m[HuyPham]\x1b[0m \x1b[35m[KhanhPhuong]\x1b[0m \x1b[96m[CEO Nguyen Cao Tri]\x1b[0m
`);
});