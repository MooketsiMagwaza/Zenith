import { renderToStaticMarkup } from "react-dom/server";
import { Layout } from "./components/Layout";
import { PAGES, pageFor, type PageId, type PageMeta } from "./site";
import { Home } from "./pages/Home";
import { Features } from "./pages/Features";
import { Privacy } from "./pages/Privacy";
import { Download } from "./pages/Download";
import { Roadmap } from "./pages/Roadmap";
import { NotFound } from "./pages/NotFound";

const views: Record<PageId, () => React.JSX.Element> = {
  home: Home,
  features: Features,
  privacy: Privacy,
  download: Download,
  roadmap: Roadmap,
  "404": NotFound,
};

export function Page({ page }: { page: PageMeta }) {
  const View = views[page.id];
  return (
    <Layout page={page}>
      <View />
    </Layout>
  );
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Used by scripts/prerender.mjs: the head tags and the body markup for one page. */
export function render(path: string): { head: string; body: string } {
  const page = pageFor(path);
  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Zenith" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    page.id === "404" ? `<meta name="robots" content="noindex" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
  return { head, body: renderToStaticMarkup(<Page page={page} />) };
}

export { PAGES };
