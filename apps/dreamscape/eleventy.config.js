import path from "path";
import { readFileSync } from "fs";
import * as sass from "sass";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import EleventyVitePlugin from "@11ty/eleventy-plugin-vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default async function(eleventyConfig) {
  eleventyConfig.addPlugin(EleventyVitePlugin, {
    viteOptions: {
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
      plugins: [
        {
          name: "restore-passthrough",
          // Re-copy static assets Vite wiped during its build phase.
          // (Vite moves _site → .11ty-vite, outputs a fresh _site.
          //  Binary assets it doesn't process don't survive the move.)
          closeBundle: async () => {
            execSync("cp -r src/assets/images _site/assets/images 2>/dev/null || true");
            execSync("cp -r src/assets/music _site/assets/music 2>/dev/null || true");
          },
        },
      ],
    },
  });

  // Inline SVG icons from src/assets/images/ by name
  eleventyConfig.addShortcode('svgIcon', function(name) {
    return readFileSync(path.resolve(__dirname, `src/assets/images/${name}.svg`), 'utf8');
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
  // In dev mode Vite serves from _site/, transforming on-the-fly (HMR).
  // In build mode Vite bundles from .11ty-vite/ (the renamed _site/).
  eleventyConfig.addPassthroughCopy("src/assets/js");

  // Static binary assets: passthrough for dev; closeBundle hook above
  // re-copies them after Vite's production build wipes and rebuilds _site/.
  eleventyConfig.addPassthroughCopy("src/assets/images");
  eleventyConfig.addPassthroughCopy("src/assets/music");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
    },
    templateFormats: ["njk", "md", "html", "scss"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
