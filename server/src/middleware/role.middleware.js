const { forbidden } = require('../utils/response.util');

/**
 * Role guard. Usage: router.get('/x', requireRoles('ORG_ADMIN','OPS_MANAGER'), handler)
 * SUPER_ADMIN always passes.
 */
function requireRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(forbidden('Authentication required'));
    if (req.user.role === 'SUPER_ADMIN') return next();
    if (roles.length && !roles.includes(req.user.role)) {
      return next(forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

/** Blocks customer/guest accounts from internal org endpoints. */
function internalOnly(req, _res, next) {
  if (req.user && ['CUSTOMER'].includes(req.user.role)) {
    return next(forbidden('Customer accounts cannot access this resource'));
  }
  next();
}

module.exports = { requireRoles, internalOnly };
