import { createProxyMiddleware, type Options } from 'http-proxy-middleware';
import type { Request } from 'express';

const CORE_API_URL = process.env.JAVA_API_URL || 'http://localhost:8000';

function forwardRequestId(proxyReq: { setHeader: (k: string, v: string) => void }, req: Request) {
  const id = req.requestId || req.headers['x-request-id'];
  if (id) proxyReq.setHeader('X-Request-Id', String(id));
}

/** Tomcat rejects Host: java_api:8000 (underscore in docker DNS name). */
function fixJavaProxyHost(proxyReq: { setHeader: (k: string, v: string) => void }) {
  try {
    const host = new URL(CORE_API_URL).host;
    if (host.includes('_')) {
      const port = new URL(CORE_API_URL).port || '8000';
      proxyReq.setHeader('host', `localhost:${port}`);
    }
  } catch {
    /* ignore */
  }
}

const proxyOptions: Options = {
  target: CORE_API_URL,
  changeOrigin: true,
  timeout: 30_000,
  proxyTimeout: 30_000,
  // Express strips the mount prefix ('/api/admin') before passing to the proxy,
  // so we must restore it when forwarding to the Java backend.
  pathRewrite: { '^/': '/api/admin/' },
  on: {
    proxyReq(proxyReq, req) {
      forwardRequestId(proxyReq, req as Request);
      fixJavaProxyHost(proxyReq);
    },
    error(err, req, res) {
      const rid = (req as Request).requestId;
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'spring_boot_proxy_error',
          requestId: rid,
          detail: err.message,
          ts: new Date().toISOString(),
        })
      );
      if ('writeHead' in res && typeof res.writeHead === 'function') {
        (res as any).status(502).json({
          error: 'Core API unavailable',
          detail: err.message,
          requestId: rid,
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
