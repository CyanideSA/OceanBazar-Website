import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Admin CRM talks only to the BFF (no Java STOMP /ws). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer Docker BFF (:4401) — local :4000 often dies / exhausts Postgres connections.
  const proxyApiTarget =
    env.ADMIN_DEV_PROXY_API || env.VITE_ADMIN_API_URL || "http://127.0.0.1:4401";

  return {
  plugins: [
    react(),
  ],

  // sockjs-client expects Node's `global`; map to `globalThis` in the browser bundle.
  define: {
    global: "globalThis",
  },

  build: {
    // Warn but don't error on large chunks
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── React core ───────────────────────────────────────────────────
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // ── Charting (recharts is heavy) ─────────────────────────────────
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'vendor-charts';
          }
          // ── Realtime / transport ─────────────────────────────────────────
          if (id.includes('node_modules/socket.io-client')) {
            return 'vendor-realtime';
          }
          // ── UI utilities ─────────────────────────────────────────────────
          if (
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/framer-motion')
          ) {
            return 'vendor-ui-utils';
          }
          // ── Lucide icons ─────────────────────────────────────────────────
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },

  server: {
    port: 5173,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: proxyApiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: proxyApiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  };
});


