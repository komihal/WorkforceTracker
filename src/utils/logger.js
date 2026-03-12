const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export const logger = {
  debug: (...args) => {
    if (isDev) console.log('[DEBUG]', ...args);
  },
  info: (...args) => {
    if (isDev) console.log('[INFO]', ...args);
  },
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
