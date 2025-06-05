import fs from "fs-extra";
import htmlmin from "html-minifier";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import postcss from "postcss";
import { EleventyServerlessBundlerPlugin } from "@11ty/eleventy";
import pluginWebC from "@11ty/eleventy-plugin-webc";
import postcssImport from "postcss-import";
import postcssNested from "postcss-nested";
import postcssEach from "postcss-each";
import autoprefixer from "autoprefixer";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";

export default function (eleventyConfig) {
  // Turn on components
  eleventyConfig.addPlugin(pluginWebC, {
    components: "src/_components/**/*.webc"
  });

  // Image optimization
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    inputDir: "images",
    formats: ["avif", "webp", "jpeg"],
    widths: [320, 640],
    outputDir: "dist/img/",
    urlPath: "/img/",
    htmlOptions: {
      imgAttributes: {
        decoding: "async",
        loading: "lazy",
        sizes: "(min-width: 36em) 33.3vw, 100vw"
      }
    }
  });

  const currentYear = new Date().getFullYear();

  // Filters
  eleventyConfig.addFilter("formatDate", (date) => {
    const dateConverted = new Date(`${date} ${currentYear}`);
    const options = {
      year: "numeric",
      month: "long",
      day: "2-digit",
      weekday: "long",
      timeZone: "UTC"
    };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options);
    const parts = dateTimeFormat.formatToParts(dateConverted);
    const partsMapped = parts.map((p) => ({ [p.type]: p.value }));
    const partsAsObject = Object.assign({}, ...partsMapped);
    return partsAsObject;
  });

  eleventyConfig.addFilter("determineLeapYear", (microseason) => {
    const { days, english_name, index } = microseason;
    const isLeapYear =
      (currentYear % 4 == 0 && currentYear % 100 != 0) ||
      currentYear % 400 == 0;

    let processedDays = days;
    if (isLeapYear && days.includes("February 28")) {
      processedDays = days.concat("February 29");
    }

    return processedDays.map((day) => ({
      value: day,
      index: index.toString().padStart(2, "0"),
      seasonName: english_name
    }));
  });

  eleventyConfig.addFilter("dayHasOccurred", (date) => {
    const firstDate = new Date(`${date} ${currentYear}`);
    const hasOccurred =
      firstDate.setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
    const isToday =
      firstDate.setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0);

    return hasOccurred ? "past" : isToday ? "present" : "future";
  });

  // Make CSS mo-betta
  eleventyConfig.addTemplateFormats("css");

  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (inputContent) {
      const result = await postcss([
        postcssImport,
        postcssNested,
        postcssEach,
        autoprefixer
      ]).process(inputContent, { from: undefined, to: undefined });

      return async () => result.css;
    }
  });

  // Markdown support
  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true
  }).use(markdownItAnchor, {
    renderHref: false,
    tabIndex: false
  });

  eleventyConfig.setLibrary("md", markdownLibrary);

  // 404 handling
  eleventyConfig.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        bs.addMiddleware("*", (req, res) => {
          const content_404 = fs.readFileSync("_site/404.html");
          console.log(content_404);
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          res.write(content_404);
          res.end();
        });
      }
    }
  });

  // HTML minification
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html")) {
      let minified = htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true
      });
      return minified;
    }
    return content;
  });

  // Passthrough static stuffs
  eleventyConfig.addPassthroughCopy({
    static: "/"
  });
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  return {
    dir: {
      includes: "",
      layouts: "_layouts",
      input: "src",
      output: "dist"
    },
    markdownTemplateEngine: "njk"
  };
}
