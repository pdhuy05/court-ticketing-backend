const http = require("http");
const socketIo = require("socket.io");
const config = require("./src/config/env");
const app = require("./src/app");
const database = require("./src/config/database");
const ticketService = require("./src/services/ticket.service");
const autoResetScheduler = require("./src/services/autoReset.service");
const User = require("./src/models/user.model");
const { setIO } = require("./src/utils/socketEmitter");

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

  const joinCounterRoom = (counterId) => {
    if (!counterId) {
      socket.emit('socket-error', {
        message: 'Thiếu counterId để join room staff'
      });
      return;
    }

    const room = `counter-${counterId}`;
    socket.join(room);
    socket.emit('joined-counter-room', {
      counterId: String(counterId),
      room
    });
    console.log(`\x1b[42m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mcounter ${counterId}\x1b[0m`);

    ticketService.getStaffDisplay(counterId)
      .then((data) => {
        socket.emit('staff-display-updated', {
          reason: 'joined-counter-room',
          counterId: String(counterId),
          updatedAt: new Date().toISOString(),
          data
        });
      })
      .catch((error) => {
        socket.emit('socket-error', {
          message: error.message || 'Không thể tải dữ liệu staff display',
          counterId: String(counterId)
        });
      });
  };

  const joinStaffDisplayRoom = async (payload) => {
    const staffId = payload?.staffId;
    const requestedCounterId = payload?.counterId || payload;

    if (!staffId) {
      joinCounterRoom(requestedCounterId);
      return;
    }

    const staff = await User.findOne({
      _id: staffId,
      role: 'staff',
      isActive: true
    }).select('counterId');

    if (!staff?.counterId) {
      socket.emit('socket-error', {
        message: 'Nhân viên chưa được gán quầy hoặc không tồn tại',
        staffId: String(staffId)
      });
      return;
    }

    const counterId = String(staff.counterId);

    if (requestedCounterId && String(requestedCounterId) !== counterId) {
      socket.emit('socket-error', {
        message: 'counterId không khớp với quầy của nhân viên',
        staffId: String(staffId),
        counterId
      });
      return;
    }

    const room = `staff-display-${staffId}`;
    socket.join(room);
    socket.emit('joined-counter-room', {
      counterId,
      staffId: String(staffId),
      room
    });
    console.log(`\x1b[42m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mstaff ${staffId}\x1b[0m`);

    ticketService.getStaffDisplay(counterId, staffId)
      .then((data) => {
        socket.emit('staff-display-updated', {
          reason: 'joined-counter-room',
          counterId,
          staffId: String(staffId),
          updatedAt: new Date().toISOString(),
          data
        });
      })
      .catch((error) => {
        socket.emit('socket-error', {
          message: error.message || 'Không thể tải dữ liệu staff display',
          counterId,
          staffId: String(staffId)
        });
      });
  };

  socket.on('join-waiting-room', () => {
    socket.join('waiting-room');
    console.log(`\x1b[43m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mwaiting-room\x1b[0m`);

    ticketService.getWaitingRoomData()
      .then((data) => {
        socket.emit('waiting-room-snapshot', {
          updatedAt: new Date().toISOString(),
          totalWaiting: data.tickets.length,
          tickets: data.tickets,
          lastIssuedByCounter: data.lastIssuedByCounter
        });
      })
      .catch((error) => {
        socket.emit('socket-error', {
          message: error.message || 'Không thể tải dữ liệu màn hình chờ'
        });
      });
  });

  socket.on('join-counter', (counterId) => {
    joinCounterRoom(counterId);
  });

  socket.on('join-staff-display', (payload) => {
    joinStaffDisplayRoom(payload).catch((error) => {
      socket.emit('socket-error', {
        message: error.message || 'Không thể join room staff display'
      });
    });
  });

  socket.on('join-admin-dashboard', () => {
    socket.join('admin-dashboard');
    console.log(`\x1b[45m\x1b[37m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35madmin-dashboard\x1b[0m`);
  });

  socket.on('disconnect', () => {
    console.log(`\x1b[41m\x1b[37m \x1b[0m \x1b[36mSocket\x1b[0m: Client disconnected - ID: \x1b[33m${socket.id}\x1b[0m`);
  });
});

setIO(io);

server.listen(config.port, () => {
  autoResetScheduler.start().catch((error) => {
    console.error(`Khởi động auto reset thất bại: ${error.message}`);
  });
  console.log(`
\x1b[42m\x1b[30m ✓ \x1b[0m \x1b[36mServer\x1b[0m: Khởi động thành công!
\x1b[90m  ├─ URL: \x1b[0m\x1b[33mhttp://localhost:${config.port}\x1b[0m
\x1b[90m  ├─ Port: \x1b[0m${config.port}
\x1b[90m  ├─ Time: \x1b[0m${new Date().toLocaleString()}
\x1b[90m  └─ Developer: \x1b[0m\x1b[35m[HuyPham]\x1b[0m \x1b[35m[KhanhPhuong]\x1b[0m \x1b[35m[CEO Nguyen Cao Tri]\x1b[0m
`);
});
