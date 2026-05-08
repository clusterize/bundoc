import { test, expect } from "bun:test";
import { resolve } from "node:path";
import { discoverContent } from "./discover.ts";
import { buildManifest, emitManifestModule } from "./manifest.ts";

const contentDir = resolve(import.meta.dir, "../../example/content");

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

  expect(Object.keys(manifest.routes).sort()).toEqual(["/", "/about", "/faq/installation"]);
  expect(manifest.routes["/"]!.en).toBeDefined();
  expect(manifest.routes["/"]!.de).toBeDefined();
  expect(manifest.routes["/"]!.en!.fallback).toBeUndefined();
  expect(manifest.routes["/"]!.de!.fallback).toBeUndefined();
  // /about is English-only; /de should fall back.
  expect(manifest.routes["/about"]!.de!.fallback).toBe(true);
  expect(manifest.routes["/about"]!.en!.fallback).toBeUndefined();
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
