const isDev = process.env.NODE_ENV === "development";

/** Logs only in development — keeps production consoles clean. */
export const logger = {
  warn: (...args) => {
    if (isDev) console.warn(...args);
  },
  error: (...args) => {
    if (isDev) console.error(...args);
  },
  info: (...args) => {
    if (isDev) console.info(...args);
  },
  debug: (...args) => {
    if (isDev && typeof console.debug === "function") console.debug(...args);
  },
};
