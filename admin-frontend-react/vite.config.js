import { defineConfig } from "vite";

import react from "@vitejs/plugin-react";



export default defineConfig({

  plugins: [react()],

  // sockjs-client expects Node's `global`; map to `globalThis` in the browser bundle.

  define: {

    global: "globalThis",

  },

  server: {

    port: 5173,

    host: true,

    strictPort: false,

  },

});


