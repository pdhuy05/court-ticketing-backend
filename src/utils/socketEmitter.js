const { setIO, getIO } = require("../socket");

const hasIO = () => Boolean(getIO());

const emitToRoom = (room, event, payload) => {
  const ioInstance = getIO();
  if (!ioInstance) {
    return null;
  }

  ioInstance.to(room).emit(event, payload);
  return payload;
};

const emitGlobal = (event, payload) => {
  const ioInstance = getIO();
  if (!ioInstance) {
    return null;
  }

  ioInstance.emit(event, payload);
  return payload;
};

module.exports = {
  setIO,
  getIO,
  hasIO,
  emitToRoom,
  emitGlobal,
};
