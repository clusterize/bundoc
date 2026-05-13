import { expect, test } from "bun:test";
import { buildHref, resolveRoute } from "./route-resolver.ts";
import type { Manifest } from "./types.ts";

const stub = (route: string, locale: string, fallback = false) => ({
  route,
  locale,
  importerKey: "k",
  importer: async () => ({ default: () => null }),
  frontmatter: {},
  title: "T",
  fallback,
});

const manifest: Manifest = {
  locales: ["en", "de"],
  defaultLocale: "en",
  basePath: "/",
  routes: {
    "/": {
      en: stub("/", "en"),
      de: stub("/", "de"),
    },
    "/faq/installation": {
      en: stub("/faq/installation", "en"),
      de: stub("/faq/installation", "de", true),
    },
  },
  nav: {
    en: { label: "", order: 0, children: [] },
    de: { label: "", order: 0, children: [] },
  },
  order: { en: ["/", "/faq/installation"], de: ["/", "/faq/installation"] },
};

test("resolveRoute: default locale, root", () => {
  const m = resolveRoute("/", manifest);
  expect(m.locale).toBe("en");
  expect(m.route).toBe("/");
  expect(m.notFound).toBe(false);
  expect(m.fallback).toBe(false);
});

test("resolveRoute: prefixed locale, root", () => {
  const m = resolveRoute("/de", manifest);
  expect(m.locale).toBe("de");
  expect(m.route).toBe("/");
});

test("resolveRoute: nested route under non-default locale", () => {
  const m = resolveRoute("/de/faq/installation", manifest);
  expect(m.locale).toBe("de");
  expect(m.route).toBe("/faq/installation");
  expect(m.fallback).toBe(true);
});

test("resolveRoute: unknown path → notFound", () => {
  const m = resolveRoute("/nope", manifest);
  expect(m.notFound).toBe(true);
});

test("buildHref: default locale unprefixed", () => {
  expect(
    buildHref({
      route: "/foo",
      locale: "en",
      defaultLocale: "en",
      basePath: "/",
    }),
  ).toBe("/foo");
  expect(
    buildHref({ route: "/", locale: "en", defaultLocale: "en", basePath: "/" }),
  ).toBe("/");
});

test("buildHref: non-default locale prefixed", () => {
  expect(
    buildHref({
      route: "/foo",
      locale: "de",
      defaultLocale: "en",
      basePath: "/",
    }),
  ).toBe("/de/foo");
  expect(
    buildHref({ route: "/", locale: "de", defaultLocale: "en", basePath: "/" }),
  ).toBe("/de");
});

test("buildHref: with basePath", () => {
  expect(
    buildHref({
      route: "/foo",
      locale: "de",
      defaultLocale: "en",
      basePath: "/docs",
    }),
  ).toBe("/docs/de/foo");
  expect(
    buildHref({
      route: "/",
      locale: "en",
      defaultLocale: "en",
      basePath: "/docs",
    }),
  ).toBe("/docs");
});
