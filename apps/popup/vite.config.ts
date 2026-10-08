import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev port and does not want the screen cleared.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: { alias: { "@shared": resolve(__dirname, "src/shared") } },
  server: { port: 1421, strictPort: true, host: "127.0.0.1" },
  build: { target: "es2022", outDir: "dist" },
});
