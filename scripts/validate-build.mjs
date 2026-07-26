import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd(), "dist");
const errors = [];
const expected = [
  "index.html", "profile.html", "projects.html", "project.html", "links.html",
  "tools.html", "files.html", "wallpapers.html", "youtube.html", "finance.html",
  "compute-lab.html", "ux-lab.html", "formulas.html", "formula.html",
  "flower-language-test.html", "four-seasons-flowers.html",
  "christmas-tree-economic.html", "zhu-bloom.html", "sitemap.xml"
];
expected.forEach((file) => !existsSync(join(root, file)) && errors.push(`Missing build output: /${file}`));

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

for (const file of files(root).filter((path) => path.endsWith(".html"))) {
  if (file.endsWith(".html.html")) errors.push(`Double extension route: ${file}`);
  const html = readFileSync(file, "utf8");
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`Missing title: ${file}`);
  if (!/<meta\s+[^>]*name=["']description["']/i.test(html)) errors.push(`Missing description: ${file}`);
  for (const match of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const href = match[1];
    if (href.startsWith("/api/")) continue;
    const target = href === "/" ? join(root, "index.html") : join(root, href.replace(/^\//, ""));
    if (!existsSync(target)) errors.push(`Broken internal link in ${file}: ${href}`);
  }
}

if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}
console.log(`Validated ${expected.length} required routes and internal build links.`);
