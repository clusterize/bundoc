import { expect, test } from "bun:test";
import { defaultPdfFilter } from "../config/index.ts";
import type {
  Manifest,
  ManifestRouteEntry,
  NavNode,
} from "../content/manifest.ts";
import { buildLocalePlan, buildSheets, firstSection } from "./plan.ts";

const entry = (
  route: string,
  locale: string,
  frontmatter: Record<string, unknown> = {},
  fallback = false,
): ManifestRouteEntry => ({
  route,
  locale,
  sourcePath: `/x${route}.mdx`,
  frontmatter,
  title: `T${route}`,
  fallback: fallback || undefined,
});

const nav: NavNode = {
  label: "",
  order: 0,
  children: [
    { route: "/", label: "Home", order: 0, children: [] },
    {
      label: "Guides",
      order: 1,
      children: [
        { route: "/guides/a", label: "A", order: 0, children: [] },
        { route: "/guides/b", label: "B", order: 1, children: [] },
      ],
    },
    {
      label: "Internal",
      order: 2,
      children: [{ route: "/internal/x", label: "X", order: 0, children: [] }],
    },
    { route: "/changelog", label: "Changelog", order: 3, children: [] },
  ],
};

const manifest: Manifest = {
  locales: ["en", "de"],
  defaultLocale: "en",
  basePath: "/",
  routes: {
    "/": { en: entry("/", "en"), de: entry("/", "de") },
    "/guides/a": {
      en: entry("/guides/a", "en"),
      de: entry("/guides/a", "de", {}, true),
    },
    "/guides/b": { en: entry("/guides/b", "en"), de: entry("/guides/b", "de") },
    "/internal/x": {
      en: entry("/internal/x", "en", { pdf: false }),
      de: entry("/internal/x", "de", { pdf: false }, true),
    },
    "/changelog": {
      en: entry("/changelog", "en"),
      de: entry("/changelog", "de", {}, true),
    },
  },
  nav: { en: nav, de: nav },
  order: { en: [], de: [] },
};

test("buildLocalePlan: nav order, breadcrumbs, frontmatter opt-out", () => {
  const plan = buildLocalePlan({
    manifest,
    locale: "en",
    filter: defaultPdfFilter,
  });
  expect(plan.sections.map((s) => s.route)).toEqual([
    "/",
    "/guides/a",
    "/guides/b",
    "/changelog",
  ]);
  expect(plan.sections.map((s) => s.anchor)).toEqual([
    "bundoc-pdf-s0",
    "bundoc-pdf-s1",
    "bundoc-pdf-s2",
    "bundoc-pdf-s3",
  ]);
  expect(plan.sections[1]?.breadcrumbs).toEqual(["Guides"]);
  // "Internal" has no included pages left, so it drops out of the outline.
  expect(plan.outline.map((n) => n.label)).toEqual([
    "Home",
    "Guides",
    "Changelog",
  ]);
  expect(plan.outline[1]?.section).toBeUndefined();
  expect(plan.outline[1]?.children.map((c) => c.section)).toEqual([1, 2]);
});

test("buildLocalePlan: fallback rows are included and flagged", () => {
  const plan = buildLocalePlan({
    manifest,
    locale: "de",
    filter: defaultPdfFilter,
  });
  expect(plan.sections.map((s) => [s.route, s.fallback])).toEqual([
    ["/", false],
    ["/guides/a", true],
    ["/guides/b", false],
    ["/changelog", true],
  ]);
});

test("buildLocalePlan: custom filter sees every row", () => {
  const plan = buildLocalePlan({
    manifest,
    locale: "de",
    filter: (p) => !p.fallback,
  });
  expect(plan.sections.map((s) => s.route)).toEqual(["/", "/guides/b"]);
});

test("firstSection: groups resolve to their first page", () => {
  const plan = buildLocalePlan({
    manifest,
    locale: "en",
    filter: defaultPdfFilter,
  });
  expect(plan.outline.map(firstSection)).toEqual([0, 1, 3]);
});

test("buildSheets: cover, toc and multi-page sections", () => {
  // cover p0, toc p1-2, s0 p3, s1 p4-6, s2 p7
  const sheets = buildSheets({ totalPages: 8, starts: [3, 4, 7], tocStart: 1 });
  expect(sheets.map((s) => [s.pageNumber, s.kind, s.section])).toEqual([
    [1, "cover", null],
    [2, "toc", null],
    [3, "toc", null],
    [4, "page", 0],
    [5, "page", 1],
    [6, "page", 1],
    [7, "page", 1],
    [8, "page", 2],
  ]);
});

test("buildSheets: no cover, no toc", () => {
  const sheets = buildSheets({ totalPages: 3, starts: [0, 2], tocStart: null });
  expect(sheets.map((s) => [s.kind, s.section])).toEqual([
    ["page", 0],
    ["page", 0],
    ["page", 1],
  ]);
});
