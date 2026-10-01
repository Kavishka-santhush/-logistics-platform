/** Wrap an async controller so rejected promises/throws reach the error middleware. */
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { h };
