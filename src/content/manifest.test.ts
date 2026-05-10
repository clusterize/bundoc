import { test, expect } from "bun:test";
import { resolve } from "node:path";
import { discoverContent } from "./discover.ts";
import { buildManifest, emitManifestModule } from "./manifest.ts";

const contentDir = resolve(import.meta.dir, "../../docs/content");

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
