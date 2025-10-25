import fs from "fs-extra";
import htmlmin from "html-minifier";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import postcss from "postcss";
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

  /*
   * Image optimization
   * Uses CloudFlare R2 + Image Resizing for remote image optimization
   */
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    statsOnly: true,
    cacheOptions: {
      duration: "365d",
      directory: ".cache/eleventy-img",
      removeUrlQueryParams: false
    },
    formats: ["avif", "webp", "jpeg"],
    widths: [320, 640],
    htmlOptions: {
      imgAttributes: {
        decoding: "async",
        loading: "lazy",
        sizes: "(min-width: 36em) 33.3vw, 100vw"
      }
    },
    urlFormat: ({ src, width, format }) => {
      /*
       * Only transform images from CloudFlare R2 image host
       * Return original URL for all other images
       */
      if (!src.startsWith("https://images.jaredpendergraft.com/")) {
        return src;
      }

      const params = [
        `w=${width}`,
        `f=${format}`,
        "q=auto",
        "metadata=none",
        "onerror=redirect"
      ];

      return src.replace(
        /^https:\/\/([^/]+)/,
        `$&/cdn-cgi/image/${params.join(",")}`
      );
    }
  });

  const currentYear = new Date().getFullYear();

  // Filters
  eleventyConfig.addFilter("formatDate", (date) => {
    const dateConverted = new Date(`${date} ${currentYear}`);
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC"
    };
    const dateTimeFormat = new Intl.DateTimeFormat("en-US", options);
    const parts = dateTimeFormat.formatToParts(dateConverted);
    const partsMapped = parts.map((p) => ({ [p.type]: p.value }));
    const partsAsObject = Object.assign({}, ...partsMapped);
    return partsAsObject;
  });

  eleventyConfig.addFilter("determineLeapYear", (dateArr) => {
    const isLeapYear =
      (currentYear % 4 == 0 && currentYear % 100 != 0) ||
      currentYear % 400 == 0;
    if (isLeapYear && dateArr.includes("February 28")) {
      return dateArr.concat("February 29");
    }
    return dateArr;
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
