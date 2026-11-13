import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname),
  build: { outDir: "dist", sourcemap: true },
  server: {
    hmr: true,
    allowedHosts: true,
    watch: {
      usePolling: false,
    },
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
