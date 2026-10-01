const { Prisma } = require('@prisma/client');
const logger = require('../utils/logger.util');
const { fail } = require('../utils/response.util');

/**
 * Attaches an HTTP `status` to thrown Error objects so controllers/services can
 * control response codes.
 */
class ApiError extends Error {
  constructor(status, message, meta) {
    super(message);
    this.status = status;
    this.meta = meta;
  }
}

// Central Express error handler (4-arity signature required)
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  const meta = err.meta;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': // unique constraint
        status = 409;
        message = `A record with this ${(err.meta?.target || 'value').toString()} already exists`;
        break;
      case 'P2025': // not found
        status = 404;
        message = 'Record not found';
        break;
      case 'P2003': // FK constraint
        status = 400;
        message = 'Referenced record does not exist';
        break;
      default:
        status = 400;
        message = 'Database request error';
    }
  } else if (err.name === 'ZodError') {
    status = 422;
    message = 'Validation failed';
  }

  if (status >= 500) logger.error(`${req.method} ${req.originalUrl}`, err);
  else logger.warn(`${req.method} ${req.originalUrl} → ${status} ${message}`);

  res.status(status).json(fail(message, meta));
}

module.exports = errorMiddleware;
module.exports.ApiError = ApiError;
