import type { APIRoute } from "astro";
import { readData } from "@lib/content";

export const prerender = true;

export const GET: APIRoute = () => {
  const base = "https://joshhuang.ccwu.cc";
  const projects = readData<any[]>("projects.json");
  const formulas = readData<any>("formulas.json").items;
  const routes = [
    "/",
    "/profile.html",
    "/projects.html",
    "/links.html",
    "/tools.html",
    "/files.html",
    "/wallpapers.html",
    "/youtube.html",
    "/finance.html",
    "/compute-lab.html",
    "/ux-lab.html",
    "/formulas.html",
    "/flower-language-test.html",
    "/four-seasons-flowers.html",
    "/christmas-tree-economic.html",
    "/zhu-bloom.html",
    ...projects.map((project) => `/projects/${project.id}.html`),
    ...formulas.map((formula: any) => `/formulas/${formula.id}.html`)
  ];
  const lastmod = new Date().toISOString().slice(0, 10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${base}${route}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
