const express = require("express");
const cors = require("cors");
const ServicesRoute = require("./routers/service.route");
const CountersRoute = require("./routers/counter.route");
const TicketsRoute = require("./routers/ticket.route");

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/services", ServicesRoute);
app.use("/api/counters", CountersRoute);
app.use("/api/tickets", TicketsRoute);

module.exports = app;