import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesiumStatic"),
  },
  server: {
    // Forward API calls to the Node server (npm run server).
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
