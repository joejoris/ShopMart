import path from "node:path";
import * as url from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [reactRouter()],
  server: { port: 3000 },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
    },
  },
});
