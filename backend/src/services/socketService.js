const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

let io = null;

const expoRoom = (expoId) => `expo:${expoId}`;
const userRoom = (userId) => `user:${userId}`;

/**
 * attaches Socket.io to the HTTP server.
 *
 * a token is optional: attendees browsing a public floor plan connect as
 * guests and still receive booth updates, while a valid token additionally
 * puts the socket in a private per-user room for notifications.
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
    // sockets idle between booth changes; keep them cheap to hold open.
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next();

    try {
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('name role');
      if (user) {
        socket.data.user = { id: String(user._id), name: user.name, role: user.role };
      }
    } catch {
      // a bad or expired token downgrades the socket to a guest rather than
      // dropping it — the floor plan is readable either way.
    }

    return next();
  });

  io.on('connection', (socket) => {
    const who = socket.data.user ? `${socket.data.user.role} ${socket.data.user.id}` : 'guest';
    logger.info('Socket connected', { id: socket.id, who });

    if (socket.data.user) socket.join(userRoom(socket.data.user.id));

    // rooms are scoped per expo so a booth change never fans out globally.
    socket.on('expo:join', (expoId) => {
      if (typeof expoId !== 'string' || !/^[a-f\d]{24}$/i.test(expoId)) return;
      socket.join(expoRoom(expoId));
      logger.debug?.('Socket joined expo room', { id: socket.id, expoId });
    });

    socket.on('expo:leave', (expoId) => {
      if (typeof expoId !== 'string') return;
      socket.leave(expoRoom(expoId));
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { id: socket.id, reason });
    });
  });

  logger.info('Socket.io ready');
  return io;
}

/** no-ops when sockets are not running (tests, scripts) rather than throwing. */
function emitToExpo(expoId, event, payload) {
  if (!io) return;
  io.to(expoRoom(expoId)).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(userRoom(userId)).emit(event, payload);
}

const getIO = () => io;

/** test/teardown helper — closes every connection and clears the instance. */
async function closeSocket() {
  if (!io) return;
  await io.close();
  io = null;
}

module.exports = { initSocket, emitToExpo, emitToUser, getIO, closeSocket, expoRoom, userRoom };
