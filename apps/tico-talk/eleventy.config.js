import path from "path";
import * as sass from "sass";
import { fileURLToPath } from "url";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default async function(eleventyConfig) {
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

  return {
    dir: { input: "src", output: "_site", includes: "_includes" },
    templateFormats: ["njk", "md", "html", "scss"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
