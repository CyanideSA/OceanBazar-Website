import { createProxyMiddleware, type Options } from 'http-proxy-middleware';

const CORE_API_URL = process.env.JAVA_API_URL || 'http://localhost:8000';

const proxyOptions: Options = {
  target: CORE_API_URL,
  changeOrigin: true,
  timeout: 30_000,
  proxyTimeout: 30_000,
  // Express strips the mount prefix ('/api/admin') before passing to the proxy,
  // so we must restore it when forwarding to the Java backend.
  pathRewrite: { '^/': '/api/admin/' },
  on: {
    error(err, _req, res) {
      console.error('[proxy] Spring Boot Core API error:', err.message);
      if ('writeHead' in res && typeof res.writeHead === 'function') {
        (res as any).status(502).json({
          error: 'Core API unavailable',
          detail: err.message,
        });
      }
    },
  },
};

/**
 * Proxies /api/admin/* routes to the Java backend, restoring the /api/admin prefix.
 */
export const coreApiProxy = createProxyMiddleware(proxyOptions);

/**
 * Proxies /api/chat/* routes to the Java backend, restoring the /api/chat prefix.
 * (Express strips the mount prefix, so we must restore it.)
 */
export const coreApiChatProxy = createProxyMiddleware({
  ...proxyOptions,
  pathRewrite: { '^/': '/api/chat/' },
});

export { CORE_API_URL };
