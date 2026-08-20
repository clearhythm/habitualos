import path from "path";
import * as sass from "sass";
import { fileURLToPath } from "url";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";
import { formatNumber } from "./src/assets/js/utils/format.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default async function(eleventyConfig) {
  // Thousands/millions separators for any number shown in a template —
  // one shared implementation (src/assets/js/utils/format.js) reused
  // here at build time rather than a template-only helper, so the same
  // formatting logic is available client-side too if ever needed.
  // Handles rounding itself, so callers don't need a separate round
  // filter first: {{ value | commas(2) }} for 2 decimals, {{ value | commas }} for none.
  eleventyConfig.addFilter("commas", (value, decimals = 0) => formatNumber(value, decimals));

  eleventyConfig.addPlugin(EleventyVitePlugin, {
    viteOptions: {
      // AI_VERIFY_HMR_PORT: set by the eleventy:serve:ai script so Claude's
      // isolated verification server never collides with the human dev
      // server's Vite HMR websocket, which otherwise defaults to a fixed
      // port (24678) regardless of --port.
      server: process.env.AI_VERIFY_HMR_PORT
        ? { hmr: { port: Number(process.env.AI_VERIFY_HMR_PORT) } }
        : undefined,
      resolve: {
        alias: {
          // Resolve workspace packages for browser JS
          "@habitualos/frontend-utils": path.resolve(__dirname, "../../packages/frontend-utils"),
        },
      },
      css: {
        preprocessorOptions: {
          scss: {
            // Load paths for SCSS partials if ever imported from JS
            loadPaths: [path.resolve(__dirname, "src/styles")],
          },
        },
      },
    },
  });

  // SCSS: keep 11ty's native compiler. HTML references /styles/main.css,
  // so 11ty compiles src/styles/main.scss → _site/styles/main.css;
  // Vite passes through the compiled CSS unchanged (and minifies in build).
  eleventyConfig.addTemplateFormats("scss");
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",
    compile: async function(inputContent, inputPath) {
      let parsed = path.parse(inputPath);
      if (parsed.name.startsWith("_")) return;

      const self = this;
      return async () => {
        let result = sass.compileString(inputContent, {
          loadPaths: [parsed.dir],
          style: "expanded",
        });
        self.addDependencies(inputPath, result.loadedUrls);
        return result.css;
      };
    },
  });

  // JS: passthrough so files land in _site/ for Vite to transform.
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/images");

  // Tico Insights' seeded demo dataset lives outside src/ (see
  // netlify/functions/_data/insights-mock-checks.json's own comments) —
  // deliberately, so the Netlify function can read the same file directly
  // without a duplicate copy inside src/. But 11ty's dev server only
  // watches dir.input ("src") by default, so without this, regenerating
  // that file (scripts/generate-insights-mock-data.cjs) never triggers a
  // rebuild — src/_data/insightsAnalytics.js would keep serving whatever
  // it read at the last build that WAS triggered by something else.
  eleventyConfig.addWatchTarget("netlify/functions/_data/insights-mock-checks.json");

  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    templateFormats: ["njk", "md", "html", "scss"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
