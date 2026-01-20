// Shared theme rendering function
import fs from "fs"
import path from "path"
import Handlebars from "handlebars";
import moment from "moment"

export const renderTheme = (themeName: string, resumeData: Object) => {
  const themePath = path.join(__dirname, "..", themeName);

  // Read template and CSS files
  const templatePath = path.join(themePath, "resume.hbs");
  const cssPath = path.join(themePath, "style.css");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found for theme ${themeName}`);
  }

  if (!fs.existsSync(cssPath)) {
    throw new Error(`CSS file not found for theme ${themeName}`);
  }

  const templateContent = fs.readFileSync(templatePath, "utf-8");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  // Compile and render the template
  return Handlebars.compile(templateContent)({
    css: cssContent,
    resume: resumeData
  });
}

// Register Handlebars helpers (shared between all themes)
Handlebars.registerHelper("paragraphSplit", function (plaintext) {
  const lines = plaintext.split(/\r\n|\r|\n/g);
  let output = "";
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]) {
      output += "<p>" + lines[i] + "</p>";
    }
  }
  return new Handlebars.SafeString(output);
});

Handlebars.registerHelper("toLowerCase", function (str) {
  return str.toLowerCase();
});

Handlebars.registerHelper("spaceToDash", function (str) {
  return str.replace(/\s/g, "-").toLowerCase();
});

Handlebars.registerHelper("MY", function (date) {
  const d = date.toString();
  return moment(d).format("MMMM YYYY");
});

Handlebars.registerHelper("Y", function (date) {
  const d = date.toString();
  return moment(d).format("YYYY");
});

Handlebars.registerHelper("DMY", function (date) {
  const d = date.toString();
  return moment(d).format("D MMMM YYYY");
});