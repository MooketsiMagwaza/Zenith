// Only the dev server loads this file (see vite.config.ts); the built site has no script.
import { createRoot } from "react-dom/client";
import { Page } from "./render";
import { pageFor } from "./site";

const page = pageFor(window.location.pathname);
document.title = page.title;
const root = document.createElement("div");
document.body.prepend(root);
createRoot(root).render(<Page page={page} />);
