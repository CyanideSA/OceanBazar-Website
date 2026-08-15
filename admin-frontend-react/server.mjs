/**
 * Admin CRM static server + reverse proxy to BFF.
 * Browser calls same-origin /api/* (port 5173) → forwarded to BFF inside Docker network.
 */
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_TARGET = process.env.ADMIN_BFF_PROXY_TARGET || "http://api:4000";
const PORT = Number(process.env.PORT || 5173);
const DIST = path.join(__dirname, "dist");

const app = express();

// #region agent log
/** Temporary same-origin debug ingest for HTTPS CRM (session 1eb282). */
app.post("/__ob-debug/ingest", express.json({ limit: "64kb" }), (req, res) => {
  try {
    const line = JSON.stringify({ ...(req.body || {}), receivedAt: Date.now() }) + "\n";
    fs.appendFileSync("/tmp/ob-debug-1eb282.ndjson", line);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "debug_log_write_failed" });
  }
});
// #endregion

const apiProxy = createProxyMiddleware({
  target: BFF_TARGET,
  changeOrigin: true,
  ws: true,
  logLevel: "warn",
  proxyTimeout: 120_000,
  timeout: 120_000,
  pathFilter: (pathname) => pathname.startsWith("/api") || pathname.startsWith("/socket.io"),
  on: {
    error(err, _req, res) {
      if (res && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "BFF proxy error", code: err?.code || "PROXY_ERROR" }));
      }
    },
  },
});

app.use(apiProxy);

// Hashed assets can be cached; HTML must never be, or clients keep old Layout JS.
app.use(
  "/assets",
  express.static(path.join(DIST, "assets"), {
    maxAge: "1y",
    immutable: true,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  })
);

app.use(
  express.static(DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
      }
    },
  })
);

app.get(/^(?!\/api).*/, (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Admin CRM listening on :${PORT}, proxying /api → ${BFF_TARGET}`);
});
