import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// The Tauri CLI sets TAURI_ENV_PLATFORM when it runs the dev server for the desktop shell, which
// expects a fixed port (see src-tauri/tauri.conf.json). The browser dev server is unchanged.
const tauri = !!process.env.TAURI_ENV_PLATFORM;

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tsconfigPaths(),
    tailwindcss(),
  ],
  clearScreen: !tauri,
  server: tauri ? { port: 1420, strictPort: true, host: "127.0.0.1" } : undefined,
  build: {
    outDir: "dist",
  },
});
