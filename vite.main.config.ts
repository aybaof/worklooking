import { defineConfig } from "vite";
import path from "path";
import { builtinModules } from "module";

export default defineConfig({
  plugins: [{
    name: 'markdown-loader',
    transform(code, id) {
      if (id.endsWith('.md')) {
        return `export default ${JSON.stringify(code)};`;
      }
    }
  }],
  build: {
    outDir: "dist-electron",
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, "electron/main.ts"),
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`)
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
