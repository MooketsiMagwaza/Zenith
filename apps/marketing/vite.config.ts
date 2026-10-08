import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * The site ships no JavaScript: `npm run build` renders every page to HTML at build time
 * (scripts/prerender.mjs). Only the dev server adds a script, so pages render while editing.
 */
const devRenderer: Plugin = {
  name: "zenith-dev-renderer",
  apply: "serve",
  transformIndexHtml: () => [
    { tag: "script", attrs: { type: "module", src: "/src/dev.tsx" }, injectTo: "body" },
  ],
};

export default defineConfig({
  plugins: [react(), tailwindcss(), devRenderer],
  server: { port: 5180 },
  build: { outDir: "dist", emptyOutDir: true },
});
