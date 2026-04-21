let ioInstance = null;

const setIO = (io) => {
    ioInstance = io;
};

const getIO = () => ioInstance;

const hasIO = () => Boolean(ioInstance);

const emitToRoom = (room, event, payload) => {
    if (!ioInstance) {
        return null;
    }

    ioInstance.to(room).emit(event, payload);
    return payload;
};

const emitGlobal = (event, payload) => {
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
    emitGlobal
};
