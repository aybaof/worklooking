import { defineConfig } from "vite";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
  plugins: [
    {
      name: "raw-loader",
      transform(code, id) {
        if (id.endsWith(".md") || id.endsWith(".hbs")) {
          return `export default ${JSON.stringify(code)};`;
        }
      },
    },
  ],
  build: {
    lib: {
      entry: {
        main: path.resolve(__dirname, "electron/main.ts"),
        preload: path.resolve(__dirname, "electron/preload.ts"),
      },
      formats: ["cjs"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        "electron",
        "openai",
        "pdf-parse",
        "sharp",
        "handlebars",
        "moment",
        "update-electron-app",
        "electron-squirrel-startup",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    ssr: true,
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
