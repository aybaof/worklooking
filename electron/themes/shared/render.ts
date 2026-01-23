// Shared theme rendering function
import Handlebars from "handlebars";
import moment from "moment";
import { themes, ThemeName } from "../index";

export const renderTheme = (themeName: ThemeName, resumeData: object): string => {
  const theme = themes[themeName];
  if (!theme) {
    throw new Error(`Unknown theme: ${themeName}`);
  }

  // Compile and render the template
  return Handlebars.compile(theme.template)({
    css: theme.styles,
    resume: resumeData,
  });
};

// Register Handlebars helpers (shared between all themes)
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
