import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/ttTikkun/",
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        transliterate: resolve(import.meta.dirname, "transliterate.html"),
      },
    },
  },
  resolve: {
    alias: {
      // hack until I actually export transliteration.js
      "havarotjs/transliteration": resolve(
        import.meta.dirname,
        "node_modules/havarotjs/dist/esm/transliteration.js"
      ),
    },
  },
});
