import { defineConfig } from "bundoc/config";

export default defineConfig({
  locales: ["en", "de"],
  defaultLocale: "en",
  contentDir: "./content",
  themeEntry: "./theme/index.tsx",
});
