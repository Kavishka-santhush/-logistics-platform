const { ApiError } = require('../middleware/error.middleware');

/* Consistent success envelope */
const ok = (data, meta) => ({ success: true, data, ...(meta ? { meta } : {}) });
const created = (data) => ({ success: true, data });
const paginated = (data, { page, pageSize, total }) => ({
  success: true,
  data,
  meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
});

/* Consistent failure envelope */
const fail = (message, meta) => ({ success: false, message, ...(meta ? { meta } : {}) });

/* Throwable helpers — controllers `throw notFound('Order')` */
const badRequest = (msg = 'Bad request', meta) => new ApiError(400, msg, meta);
const unauthorized = (msg = 'Unauthorized') => new ApiError(401, msg);
const forbidden = (msg = 'Forbidden') => new ApiError(403, msg);
const notFound = (msg = 'Resource not found') => new ApiError(404, msg);
const conflict = (msg = 'Conflict') => new ApiError(409, msg);
const unprocessable = (msg = 'Unprocessable', meta) => new ApiError(422, msg, meta);
const tooMany = (msg = 'Too many requests') => new ApiError(429, msg);

module.exports = {
  ok,
  created,
  paginated,
  fail,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
  tooMany,
};
