import { defineConfig } from "vitest/config";
import path from "path";
import type { Plugin } from "vite";

/**
 * Mirrors the `raw-loader` plugin in `vite.main.config.ts` so that
 * `import template from "./resume.hbs"` works inside tests exactly as it does
 * in the real main-process build. `.css?raw` is handled natively by Vite.
 */
const rawLoader = (): Plugin => ({
  name: "test-raw-loader",
  transform(code, id) {
    if (id.endsWith(".md") || id.endsWith(".hbs")) {
      return `export default ${JSON.stringify(code)};`;
    }
    return undefined;
  },
});

const alias = { "@": path.resolve(__dirname, "./src") };

export default defineConfig({
  plugins: [rawLoader()],
  resolve: { alias },
  test: {
    globals: true,
    // Two isolated environments: Node for main/shared, jsdom for the renderer.
    projects: [
      {
        plugins: [rawLoader()],
        resolve: { alias },
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: [
            "electron/**/*.{test,spec}.ts",
            "shared/**/*.{test,spec}.ts",
            "tests/node/**/*.{test,spec}.ts",
          ],
        },
      },
      {
        plugins: [rawLoader()],
        resolve: { alias },
        test: {
          name: "renderer",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./tests/setup.renderer.ts"],
          include: [
            "src/**/*.{test,spec}.{ts,tsx}",
            "tests/renderer/**/*.{test,spec}.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
