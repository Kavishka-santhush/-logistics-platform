require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket');
const { startJobs } = require('./src/jobs');
const logger = require('./src/utils/logger.util');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Socket.io — live GPS tracking, dispatch board, notifications
initSocket(server);

// Scheduled jobs — maintenance alerts, document expiry, invoice automation
if (process.env.NODE_ENV !== 'test') {
  startJobs();
}

server.listen(PORT, () => {
  logger.info(`Logistics API listening on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
});

module.exports = server;
