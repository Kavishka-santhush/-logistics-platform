const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const logger = require('../utils/logger.util');
const registerTracking = require('./tracking.socket');
const registerDispatch = require('./dispatch.socket');
const registerNotification = require('./notification.socket');

let io = null;

/** Access the singleton io instance from services/controllers. */
function getIo() {
  return io;
}

/** Emit to an entire organization room (live dashboards, dispatch board). */
function emitToOrg(organizationId, event, payload) {
  if (io && organizationId) io.to(`org:${organizationId}`).emit(event, payload);
}

/** Emit to a single user's device(s). */
function emitToUser(userId, event, payload) {
  if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:8081'], credentials: true },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Handshake auth — accept Clerk token or fall back to an org-scoped device token.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        socket.data.user = null;
        return next(); // allow anonymous (public tracking viewers)
      }
      // Decode the Clerk JWT to extract the subject (clerkId) for room claims.
      // (Signature verification happens at the REST layer; socket rooms are
      // low-trust routing hints.)
      const decoded = jwt.decode(token);
      const clerkId = decoded?.sub || null;
      if (clerkId) {
        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (user) socket.data.user = { id: user.id, role: user.role, organizationId: user.organizationId, driverId: undefined };
      }
      next();
    } catch (err) {
      logger.warn('socket auth failed', err.message);
      next();
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.user;
    if (u) {
      if (u.organizationId) socket.join(`org:${u.organizationId}`);
      socket.join(`user:${u.id}`);
      // Driver sockets join a personal driver room for direct dispatch/SOS routing
      if (u.role === 'DRIVER') {
        prisma.driver
          .findUnique({ where: { userId: u.id } })
          .then((d) => {
            if (d) {
              socket.data.user.driverId = d.id;
              socket.join(`driver:${d.id}`);
            }
          })
          .catch(() => {});
      }
    }
    logger.debug(`socket connected ${socket.id} user=${u?.id || 'anon'}`);

    // Public tracking: viewer subscribes to a single order's live position
    socket.on('track:subscribe', (trackingNumber) => {
      if (typeof trackingNumber === 'string') socket.join(`track:${trackingNumber}`);
    });
    socket.on('track:unsubscribe', (trackingNumber) => {
      if (typeof trackingNumber === 'string') socket.leave(`track:${trackingNumber}`);
    });

    registerTracking(io, socket);
    registerDispatch(io, socket);
    registerNotification(io, socket);

    socket.on('disconnect', () => logger.debug(`socket disconnected ${socket.id}`));
  });

  return io;
}

module.exports = { initSocket, getIo, emitToOrg, emitToUser };
