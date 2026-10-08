// Renders every page of the site to static HTML, using the template Vite built (dist/index.html,
// which carries the hashed stylesheet) and the server build of src/render.tsx (.ssr/render.js).
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ssr = join(root, ".ssr");

const template = await readFile(join(dist, "index.html"), "utf8");
if (/<script/i.test(template)) throw new Error("the built template has a script; the site must ship none");
const { render, PAGES } = await import(pathToFileURL(join(ssr, "render.js")).href);

for (const page of PAGES) {
  const { head, body } = render(page.path);
  const html = template.replace("<!--head-->", head).replace("<!--body-->", body);
  const file = page.id === "404" ? join(dist, "404.html") : join(dist, page.path, "index.html");
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  console.log(`rendered ${page.path} -> ${file.slice(root.length + 1)}`);
}

await rm(ssr, { recursive: true, force: true });
