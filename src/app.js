const express = require("express");
const cors = require("cors");
const ServicesRoute = require("./routers/service.route");
const CountersRoute = require("./routers/counter.route");
const TicketsRoute = require("./routers/ticket.route");
const PrintersRoute = require("./routers/printer.route");
const AuthRoute = require("./routers/auth.route");
const AdminUserRoute = require("./routers/admin/user.route");


const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/services", ServicesRoute);
app.use("/api/counters", CountersRoute);
app.use("/api/tickets", TicketsRoute);
app.use("/api/printers", PrintersRoute)
app.use("/api/auth", AuthRoute)
app.use("/api/admin/users", AdminUserRoute);  

app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;