import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [tailwindcss(), react(), {
    name: 'markdown-loader',
    transform(code, id) {
      if (id.endsWith('.md')) {
        return `export default ${JSON.stringify(code)};`;
      }
    }
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
