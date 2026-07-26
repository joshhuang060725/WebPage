import { defineConfig } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  site: "https://joshhuang.ccwu.cc",
  output: "static",
  build: {
    format: "file"
  },
  vite: {
    plugins: [
      viteStaticCopy({
        targets: [
          { src: "assets", dest: "." },
          { src: "data", dest: "." },
          { src: "docs", dest: "." },
          { src: "favicon.svg", dest: "." },
          { src: "og-image.svg", dest: "." },
          { src: "robots.txt", dest: "." },
          { src: "_headers", dest: "." },
          { src: "_routes.json", dest: "." },
          { src: "flower-language-test.html", dest: "." },
          { src: "flower-language-test.css", dest: "." },
          { src: "four-seasons-flowers.html", dest: "." },
          { src: "four-seasons-flowers.css", dest: "." },
          { src: "christmas-tree-economic.html", dest: "." },
          { src: "christmas-tree-economic.css", dest: "." },
          { src: "zhu-bloom.html", dest: "." },
          { src: "formula.html", dest: ".", rename: "formula-interactive.html" },
          { src: "styles.css", dest: "." },
          { src: "js/data-loader.js", dest: "js" },
          { src: "js/main.js", dest: "js" },
          { src: "js/formula-detail.js", dest: "js" },
          { src: "js/flower-language-test.js", dest: "js" },
          { src: "js/four-seasons-flowers.js", dest: "js" },
          { src: "js/christmas-tree-economic.js", dest: "js" }
        ]
      })
    ]
  }
});
