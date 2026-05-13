import { defineConfig } from "@clusterize/bundoc/config";

export default defineConfig({
  locales: ["en", "de"],
  defaultLocale: "en",
  contentDir: "./content",
  themeEntry: "./theme/index.tsx",
  mdx: {
    highlighting: { light: "github-light", dark: "github-dark" },
  },
});
