import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 0.0.0.0 — reachable from phone on same Wi‑Fi
    port: 5175,
    proxy: {
      "/api": "http://localhost:8790",
    },
  },
});
