const { ADMIN_DASHBOARD_ROOM } = require('./dashboard.service');

const ADMIN_NOTIFICATION_EVENT = 'admin-notification:new';

const emitAdminNotification = (payload) => {
  if (!global.io) {
    return null;
  }

  const notification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: payload.type || 'system',
    severity: payload.severity || 'info',
    title: payload.title || 'Thông báo hệ thống',
    message: payload.message || '',
    source: payload.source || 'system',
    meta: payload.meta || {},
    createdAt: new Date().toISOString()
  };

  global.io.to(ADMIN_DASHBOARD_ROOM).emit(ADMIN_NOTIFICATION_EVENT, notification);

  return notification;
};

const emitAdminNotificationSafe = (payload) => {
  try {
    return emitAdminNotification(payload);
  } catch (error) {
    console.error(`Không thể gửi thông báo nội bộ cho admin: ${error.message}`);
    return null;
  }
};

const notifySystemError = ({ title, message, source, meta, severity = 'error' }) => {
  return emitAdminNotificationSafe({
    type: 'system-error',
    severity,
    title: title || 'Lỗi hệ thống',
    message,
    source,
    meta
  });
};

module.exports = {
  ADMIN_NOTIFICATION_EVENT,
  emitAdminNotification,
  emitAdminNotificationSafe,
  notifySystemError
};
