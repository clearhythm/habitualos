const path = require("path");
const sass = require("sass");

module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/scripts");
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/images");

  // Compile SCSS natively so 11ty watches partials and live-reloads CSS
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
          style: "expanded"
        });
        self.addDependencies(inputPath, result.loadedUrls);
        return result.css;
      };
    }
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html", "scss"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
