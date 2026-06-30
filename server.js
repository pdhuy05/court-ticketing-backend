const http = require("http");
const socketIo = require("socket.io");
const config = require("./src/config/env");
const app = require("./src/app");
const database = require("./src/config/database");
const ticketService = require("./src/services/ticket.service");
const autoResetScheduler = require("./src/services/autoReset.service");
const autoSchedulerService = require("./src/services/autoScheduler.service");
const settingService = require("./src/services/setting.service");
const User = require("./src/models/user.model");
const logger = require("./src/utils/Logger");
const { setIO } = require("./src/socket");
const { printServerBanner, printSchedulerBanner } = require("./src/utils/banner");

database();

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  logger.info(`Socket client kết nối: ${socket.id}`);

  const joinCounterRoom = (counterId) => {
    if (!counterId) {
      socket.emit("socket-error", {
        message: "Thiếu counterId để join room staff",
      });
      return;
    }

    const room = `counter-${counterId}`;
    socket.join(room);
    socket.emit("joined-counter-room", {
      counterId: String(counterId),
      room,
    });
    console.log(
      `\x1b[42m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mcounter ${counterId}\x1b[0m`,
    );

    ticketService
      .getStaffDisplay(counterId)
      .then((data) => {
        socket.emit("staff-display-updated", {
          reason: "joined-counter-room",
          counterId: String(counterId),
          updatedAt: new Date().toISOString(),
          data,
        });
      })
      .catch((error) => {
        socket.emit("socket-error", {
          message: error.message || "Không thể tải dữ liệu staff display",
          counterId: String(counterId),
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
      role: "staff",
      isActive: true,
    }).select("counterId");

    if (!staff?.counterId) {
      socket.emit("socket-error", {
        message: "Nhân viên chưa được gán phòng hoặc không tồn tại",
        staffId: String(staffId),
      });
      return;
    }

    const counterId = String(staff.counterId);

    if (requestedCounterId && String(requestedCounterId) !== counterId) {
      socket.emit("socket-error", {
        message: "counterId không khớp với phòng của nhân viên",
        staffId: String(staffId),
        counterId,
      });
      return;
    }

    const room = `staff-display-${staffId}`;
    socket.join(room);
    socket.emit("joined-counter-room", {
      counterId,
      staffId: String(staffId),
      room,
    });
    console.log(
      `\x1b[42m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mstaff ${staffId}\x1b[0m`,
    );

    ticketService
      .getStaffDisplay(counterId, staffId)
      .then((data) => {
        socket.emit("staff-display-updated", {
          reason: "joined-counter-room",
          counterId,
          staffId: String(staffId),
          updatedAt: new Date().toISOString(),
          data,
        });
      })
      .catch((error) => {
        socket.emit("socket-error", {
          message: error.message || "Không thể tải dữ liệu staff display",
          counterId,
          staffId: String(staffId),
        });
      });
  };

  socket.on("join-waiting-room", () => {
    socket.join("waiting-room");
    console.log(
      `\x1b[43m\x1b[30m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35mwaiting-room\x1b[0m`,
    );

    ticketService
      .getWaitingRoomData()
      .then((data) => {
        socket.emit("waiting-room-snapshot", {
          updatedAt: new Date().toISOString(),
          totalWaiting: data.tickets.length,
          tickets: data.tickets,
          lastIssuedByCounter: data.lastIssuedByCounter,
        });
      })
      .catch((error) => {
        socket.emit("socket-error", {
          message: error.message || "Không thể tải dữ liệu màn hình chờ",
        });
      });
  });

  socket.on("join-counter", (counterId) => {
    joinCounterRoom(counterId);
  });

  socket.on("join-staff-display", (payload) => {
    joinStaffDisplayRoom(payload).catch((error) => {
      socket.emit("socket-error", {
        message: error.message || "Không thể join room staff display",
      });
    });
  });

  socket.on("join-admin-dashboard", () => {
    socket.join("admin-dashboard");
    console.log(
      `\x1b[45m\x1b[37m \x1b[0m \x1b[36mSocket\x1b[0m: Client \x1b[33m${socket.id}\x1b[0m joined \x1b[35madmin-dashboard\x1b[0m`,
    );
  });

  socket.on("disconnect", (reason) => {
    logger.info(`Socket client ngắt kết nối: ${socket.id} — ${reason}`);
  });
});

setIO(io);

const SCHEDULER_LABELS = [
  "Auto reset ticket",
  "Auto mở ca staff & tự động mở/đóng quầy",
  "Seed site config defaults",
];

server.listen(config.port, async () => {
  logger.success(`Socket.IO sẵn sàng tại ws://localhost:${config.port}`);

  printServerBanner(config.port);

  const results = await Promise.allSettled([
    autoResetScheduler.start(),
    autoSchedulerService.start(),
    settingService.seedSiteConfigDefaults(),
  ]);

  printSchedulerBanner(results, SCHEDULER_LABELS);
});