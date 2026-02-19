// Shared theme rendering function
import Handlebars from "handlebars";
import moment from "moment";
import { themes, ThemeName } from "../index";

export const renderTheme = (themeName: ThemeName, resumeData: any): string => {
  const theme = themes[themeName];
  if (!theme) {
    throw new Error(`Unknown theme: ${themeName}`);
  }

  // Compile and render the template
  const html = Handlebars.compile(theme.template)({
    css: theme.styles,
    resume: resumeData,
  });

  // Debug: Check if image is in the output
  const imgMatch = html.match(/src="data:image[^"]+"/);
  if (imgMatch) {
    console.log(
      `[renderTheme] Image src length in HTML: ${imgMatch[0].length}`,
    );
  } else {
    console.warn(`[renderTheme] No image found in HTML output!`);
  }

  return html;
};

// Register Handlebars helpers (shared between all themes)

// Helper to safely output base64 image data without truncation
Handlebars.registerHelper("safeImage", function (imageData: string) {
  if (!imageData) return "";
  // Return as SafeString to prevent escaping and truncation
  return new Handlebars.SafeString(imageData);
});

Handlebars.registerHelper("paragraphSplit", function (plaintext: string) {
  const lines = plaintext.split(/\r\n|\r|\n/g);
  let output = "";
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]) {
      output += "<p>" + lines[i] + "</p>";
    }
  }
  return new Handlebars.SafeString(output);
});

Handlebars.registerHelper("toLowerCase", function (str: string) {
  return str.toLowerCase();
});

Handlebars.registerHelper("spaceToDash", function (str: string) {
  return str.replace(/\s/g, "-").toLowerCase();
});

Handlebars.registerHelper("MY", function (date: string | Date) {
  const d = date.toString();
  return moment(d).format("MMMM YYYY");
});

Handlebars.registerHelper("Y", function (date: string | Date) {
  const d = date.toString();
  return moment(d).format("YYYY");
});

Handlebars.registerHelper("DMY", function (date: string | Date) {
  const d = date.toString();
  return moment(d).format("D MMMM YYYY");
});
