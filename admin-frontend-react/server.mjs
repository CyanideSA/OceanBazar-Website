/**
 * Admin CRM static server + reverse proxy to BFF.
 * Browser calls same-origin /api/* (port 5173) → forwarded to BFF inside Docker network.
 */
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BFF_TARGET = process.env.ADMIN_BFF_PROXY_TARGET || "http://api:4000";
const PORT = Number(process.env.PORT || 5173);

const app = express();

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
      // #region agent log
      fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9a9989'},body:JSON.stringify({sessionId:'9a9989',location:'server.mjs:proxy',message:'admin_proxy_error',data:{code:err?.code,message:err?.message},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (res && !res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "BFF proxy error", code: err?.code || "PROXY_ERROR" }));
      }
    },
  },
});

app.use(apiProxy);

app.use(express.static(path.join(__dirname, "dist")));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Admin CRM listening on :${PORT}, proxying /api → ${BFF_TARGET}`);
});
