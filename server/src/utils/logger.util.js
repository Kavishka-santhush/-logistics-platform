/* Minimal structured logger with levels + timestamps. Swap for pino/winston in prod. */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const active = LEVELS[process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')];

function line(level, msg, extra) {
  const ts = new Date().toISOString();
  const base = `${ts} [${level.toUpperCase()}] ${msg}`;
  if (extra instanceof Error) return `${base}\n${extra.stack || extra.message}`;
  if (extra !== undefined) return `${base} ${safeJson(extra)}`;
  return base;
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const logger = {
  debug: (msg, extra) => active <= LEVELS.debug && console.debug(line('debug', msg, extra)),
  info: (msg, extra) => active <= LEVELS.info && console.info(line('info', msg, extra)),
  warn: (msg, extra) => active <= LEVELS.warn && console.warn(line('warn', msg, extra)),
  error: (msg, extra) => active <= LEVELS.error && console.error(line('error', msg, extra)),
};

module.exports = logger;
