import path from "node:path";
import * as url from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    port: 3000,
    // Browser connects to the Vite HMR socket directly — going through Apache's
    // reverse proxy on :80 would downgrade the WebSocket upgrade (HTTP 200) and
    // log a console error on every page.
    hmr: {
      host: "localhost",
      port: 3000,
      protocol: "ws",
    },
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
  },
});
