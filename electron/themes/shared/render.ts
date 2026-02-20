// Shared theme rendering function
import Handlebars from "handlebars";
import moment from "moment";
import { themes, ThemeName } from "../index";

export const renderTheme = (themeName: ThemeName, resumeData: any): string => {
  const theme = themes[themeName];
  if (!theme) {
    throw new Error(`Unknown theme: ${themeName}`);
  }

  // Compile the template with options to prevent truncation
  const template = Handlebars.compile(theme.template, {
    noEscape: false, // Keep HTML escaping for security
    strict: false,
    assumeObjects: false,
    preventIndent: false,
    ignoreStandalone: false,
    explicitPartialContext: false,
    // No string length limits
  });

  // Render with the data
  return template({
    css: theme.styles,
    resume: resumeData,
  });
};

// Register Handlebars helpers (shared between all themes)

// Helper to safely output base64 image data without truncation
Handlebars.registerHelper("safeImage", function (imageData: string) {
  if (!imageData) return "";

  // Ensure the string is treated as-is without any processing
  // Use SafeString to prevent HTML escaping
  // Handlebars can truncate long strings, so we explicitly mark it as safe
  const value = new Handlebars.SafeString(imageData)
  return value
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
