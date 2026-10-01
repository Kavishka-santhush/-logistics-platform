const { badRequest } = require('../utils/response.util');

/**
 * Zod validation middleware factory.
 * validate({ body: schema, query: schema, params: schema })
 * Parsed values are written back onto req so controllers get coerced types.
 */
function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const key of ['params', 'query', 'body']) {
        if (schemas[key]) {
          const parsed = schemas[key].parse(req[key]);
          if (key === 'query') {
            // Express 5 treats req.query as read-only getter; mutate safely
            Object.assign(req[key], parsed);
          } else {
            req[key] = parsed;
          }
        }
      }
      next();
    } catch (err) {
      if (err.errors) {
        const first = err.errors[0];
        return next(
          badRequest(`${first.path.join('.')}: ${first.message}`, {
            details: err.errors,
          })
        );
      }
      next(err);
    }
  };
}

module.exports = validate;
