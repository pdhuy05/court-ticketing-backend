const express = require("express");
const cors = require("cors");
const ServicesRoute = require("./routers/service.route");
const CountersRoute = require("./routers/counter.route");
const TicketsRoute = require("./routers/ticket.route");
const PrintersRoute = require("./routers/printer.route");
const AuthRoute = require("./routers/auth.route");
const AdminUserRoute = require("./routers/admin/user.route");
const AdminDashboardRoute = require("./routers/admin/dashboard.route");
const AdminTicketRoute = require("./routers/admin/ticket.route");
const AdminSettingsRoute = require("./routers/admin/settings.route");
const AdminBackupRoute = require("./routers/admin/backup.route");
const StatisticsRoute = require("./routers/statistics.route");
const { notifySystemError } = require("./services/admin-notification.service");


const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/services", ServicesRoute);
app.use("/api/counters", CountersRoute);
app.use("/api/tickets", TicketsRoute);
app.use("/api/printers", PrintersRoute)
app.use("/api/auth", AuthRoute)
app.use("/api/admin/users", AdminUserRoute);  
app.use("/api/admin/dashboard", AdminDashboardRoute);
app.use("/api/admin/tickets", AdminTicketRoute);
app.use("/api/admin/settings", AdminSettingsRoute);
app.use("/api/admin/backups", AdminBackupRoute);
app.use("/api/statistics", StatisticsRoute);

app.use((err, req, res, next) => {
  notifySystemError({
    title: 'API lỗi',
    message: err.message || 'Internal Server Error',
    source: `${req.method} ${req.originalUrl}`,
    meta: {
      statusCode: err.statusCode || 500
    }
  });

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
