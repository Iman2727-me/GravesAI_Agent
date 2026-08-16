import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const pages = process.env.GITHUB_PAGES === "1";

export default defineConfig({
  base: pages ? "/GravesAI_Agent/" : "/",
  plugins: [react()],
  server: {
    host: true,
    port: 5175,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:8790",
    },
  },
});
