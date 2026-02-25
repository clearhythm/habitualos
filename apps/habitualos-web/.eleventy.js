module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/scripts");
  eleventyConfig.addWatchTarget("_site/css/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
};
