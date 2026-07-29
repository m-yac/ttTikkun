import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/ttTikkun/",
  resolve: {
    alias: {
      // hack until I actually export transliteration.js
      "havarotjs/transliteration": resolve(
        __dirname,
        "node_modules/havarotjs/dist/esm/transliteration.js"
      ),
    },
  },
});
