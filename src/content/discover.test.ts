import { test, expect } from "bun:test";
import { parseFilename, discoverContent } from "./discover.ts";
import { resolve } from "node:path";

const locales = new Set(["en", "de"]);

test("parseFilename: index.mdx → /", () => {
  expect(parseFilename("index.mdx", locales)).toEqual({ route: "/", locale: undefined });
});

test("parseFilename: locale-suffixed root index", () => {
  expect(parseFilename("index.de.mdx", locales)).toEqual({ route: "/", locale: "de" });
});

test("parseFilename: nested file", () => {
  expect(parseFilename("faq/installation.mdx", locales)).toEqual({
    route: "/faq/installation",
    locale: undefined,
  });
});

test("parseFilename: nested locale-suffixed file", () => {
  expect(parseFilename("faq/installation.de.mdx", locales)).toEqual({
    route: "/faq/installation",
    locale: "de",
  });
});

test("parseFilename: nested index", () => {
  expect(parseFilename("faq/index.mdx", locales)).toEqual({
    route: "/faq",
    locale: undefined,
  });
});

test("parseFilename: unknown locale-shaped suffix → undefined", () => {
  expect(parseFilename("foo.xx.mdx", locales)).toBeUndefined();
});

test("parseFilename: dotted name (not a locale) is preserved", () => {
  expect(parseFilename("v1.2.3.mdx", locales)).toEqual({
    route: "/v1.2.3",
    locale: undefined,
  });
});

test("discoverContent: docs/content groups by route + locale", async () => {
  const contentDir = resolve(import.meta.dir, "../../docs/content");
  const { routes } = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const r = [...routes.keys()].sort();
  expect(r).toEqual(["/", "/about", "/faq/installation"]);
  const root = routes.get("/")!;
  expect(Object.keys(root.entries).sort()).toEqual(["de", "en"]);
  // About is English-only.
  expect(Object.keys(routes.get("/about")!.entries)).toEqual(["en"]);
});
