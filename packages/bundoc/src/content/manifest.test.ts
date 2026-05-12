import { test, expect } from "bun:test";
import { resolve } from "node:path";
import { discoverContent } from "./discover.ts";
import { buildManifest, emitManifestModule } from "./manifest.ts";

const contentDir = resolve(import.meta.dir, "../../../docs/content");

test("buildManifest: all locales resolvable, fallback flagged when needed", async () => {
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });

  // Root has both locales; no fallback flag.
  expect(manifest.routes["/"]!.en).toBeDefined();
  expect(manifest.routes["/"]!.de).toBeDefined();
  expect(manifest.routes["/"]!.en!.fallback).toBeUndefined();
  expect(manifest.routes["/"]!.de!.fallback).toBeUndefined();
  // English-only routes fall back to English when the German locale asks.
  const installation = manifest.routes["/getting-started/installation"];
  expect(installation).toBeDefined();
  expect(installation!.en!.fallback).toBeUndefined();
  expect(installation!.de!.fallback).toBe(true);
  expect(manifest.order.en!.length).toBeGreaterThan(0);
  expect(manifest.order.de!.length).toBeGreaterThan(0);
});

test("nav tree groups all routes under a single category even when _meta.json overrides the label", async () => {
  // Regression: a `_meta.json` setting `"api": "API"` used to make the
  // category-lookup miss its match (it compared `humanise("api")` = "Api"
  // to the existing node's overridden label "API"), so every leaf got its
  // own duplicate "API" category in the sidebar.
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });
  const apiCategories = manifest.nav.en!.children.filter(
    (c) => c.seg === "api" || c.label === "API",
  );
  expect(apiCategories.length).toBe(1);
  // And it should have all four expected leaves (config, hooks, components, cli, manifest).
  expect(apiCategories[0]!.children.length).toBeGreaterThanOrEqual(4);
});

test("emitManifestModule: produces evaluatable JS string", async () => {
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });
  const src = emitManifestModule({
    manifest,
    contentDir,
    emittedFromDir: contentDir,
  });
  expect(src).toContain("const manifest =");
  expect(src).toContain("export default manifest;");
  expect(src).toContain("import(");
});
