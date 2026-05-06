const express = require("express");
const cors = require("cors");
const ApiError = require("./utils/ApiError");
const ServicesRoute = require("./routers/service.route");
const CountersRoute = require("./routers/counter.route");
const TicketsRoute = require("./routers/ticket.route");
const PrintersRoute = require("./routers/printer.route");
const AuthRoute = require("./routers/auth.route");
const AdminUserRoute = require("./routers/admin/user.route");
const { adminRouter: AdminDashboardRoute, publicRouter: DashboardRoute } = require("./routers/admin/dashboard.route");
const AdminTicketRoute = require("./routers/admin/ticket.route");
const AdminSettingsRoute = require("./routers/admin/settings.route");
const AdminShiftRoute = require("./routers/admin/shift.route");
const StatisticsRoute = require("./routers/statistics.route");

const { notifySystemError } = require("./services/admin-notification.service");

const duplicateFieldLabelMap = {
  name: "Tên",
  code: "Mã",
  number: "Số phòng",
  username: "Tên đăng nhập",
  ipAddress: "Địa chỉ IP máy in",
  counterId: "Phòng",
  "serviceId+counterId": "Quan hệ phòng và quầy",
  "counterId+serviceId": "Quan hệ phòng và quầy",
  "staffId+serviceId": "Quan hệ nhân viên và quầy",
};

const getDuplicateFieldLabel = (err) => {
  const duplicatedFields = Object.keys(err?.keyPattern || err?.keyValue || {});

  if (duplicatedFields.length === 0) {
    return null;
  }

  const compoundKey = duplicatedFields.join("+");
  if (duplicateFieldLabelMap[compoundKey]) {
    return duplicateFieldLabelMap[compoundKey];
  }

  if (duplicatedFields.length === 1) {
    return duplicateFieldLabelMap[duplicatedFields[0]] || null;
  }

  return null;
};

const normalizeError = (err) => {
  if (err instanceof ApiError || err?.statusCode) {
    return err;
  }

  if (err?.name === "ValidationError") {
    const message = Object.values(err.errors || {})
      .map((item) => item.message)
      .filter(Boolean)
      .join("; ");

    return new ApiError(400, message || "Dữ liệu không hợp lệ");
  }

  if (err?.name === "CastError") {
    return new ApiError(400, `${err.path || "Dữ liệu"} không hợp lệ`);
  }

  if (err?.code === 11000) {
    const fieldLabel = getDuplicateFieldLabel(err);

    if (fieldLabel) {
      return new ApiError(
        409,
        `${fieldLabel} đã tồn tại, vui lòng chọn giá trị khác`,
      );
    }

    return new ApiError(409, "Dữ liệu đã tồn tại, vui lòng kiểm tra lại");
  }

  if (
    err?.name === "MongoServerError" ||
    err?.name === "MongoError" ||
    err?.name === "MongooseError"
  ) {
    return new ApiError(
      500,
      `Lỗi database: ${err.message || "Database error"}`,
    );
  }

  return new ApiError(500, err?.message || "Internal Server Error");
};

const app = express();

app.use(cors());

app.use(express.json());

app.use("/api/services", ServicesRoute);
app.use("/api/counters", CountersRoute);
app.use("/api/tickets", TicketsRoute);
app.use("/api/printers", PrintersRoute);
app.use("/api/auth", AuthRoute);
app.use("/api/admin/users", AdminUserRoute);
app.use("/api/admin/dashboard", AdminDashboardRoute);
app.use("/api/admin/tickets", AdminTicketRoute);
app.use("/api/admin/settings", AdminSettingsRoute);
app.use("/api/admin/shift", AdminShiftRoute);
app.use("/api/statistics", StatisticsRoute);
app.use("/api/dashboard", DashboardRoute);

app.use((err, req, res, next) => {
  const normalizedError = normalizeError(err);

  notifySystemError({
    title: "API lỗi",
    message: normalizedError.message || "Internal Server Error",
    source: `${req.method} ${req.originalUrl}`,
    meta: {
      statusCode: normalizedError.statusCode || 500,
    },
  });

  res.status(normalizedError.statusCode || 500).json({
    success: false,
    message: normalizedError.message || "Internal Server Error",
  });
});

module.exports = app;