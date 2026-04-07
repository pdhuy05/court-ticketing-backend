const http = require("http");
const socketIo = require("socket.io");
const config = require("./src/config/env");
const app = require("./src/app");
const database = require("./src/config/database");

database();

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`\x1b[44m\x1b[37m \x1b[0m \x1b[36mSocket\x1b[0m: Client connected - ID: \x1b[33m${socket.id}\x1b[0m`);

  socket.on('join-waiting-room', () => {
    socket.join('waiting-room');
    console.log(`\x1b[43m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mwaiting-room\x1b[0m`);
  });

  socket.on('join-counter', (counterId) => {
    const room = `counter-${counterId}`;
    socket.join(room);
    console.log(`\x1b[42m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mcounter ${counterId}\x1b[0m`);
  });

  socket.on('disconnect', () => {
    console.log(`\x1b[41m\x1b[37m \x1b[0m \x1b[36mSocket\x1b[0m: Client disconnected - ID: \x1b[33m${socket.id}\x1b[0m`);
  });
});

global.io = io;

server.listen(config.port, () => {
  console.log(`
\x1b[42m\x1b[30m ✓ \x1b[0m \x1b[36mServer\x1b[0m: Khởi động thành công!
\x1b[90m  ├─ URL: \x1b[0m\x1b[33mhttp://localhost:${config.port}\x1b[0m
\x1b[90m  ├─ Port: \x1b[0m${config.port}
\x1b[90m  ├─ Time: \x1b[0m${new Date().toLocaleString()}
\x1b[90m  └─ Developer: \x1b[0m\x1b[35m[HuyPham]\x1b[0m \x1b[35m[KhanhPhuong]\x1b[0m \x1b[35m[CEO Nguyen Cao Tri]\x1b[0m
`);
});