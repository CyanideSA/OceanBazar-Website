import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyApiTarget = process.env.CONTENT_ID_DEV_PROXY_API || "http://127.0.0.1:4000";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  server: {
    port: 5180,
    host: true,
    strictPort: false,
    proxy: {
      "/api": {
        target: proxyApiTarget,
        changeOrigin: true,
      },
    },
  },
});
