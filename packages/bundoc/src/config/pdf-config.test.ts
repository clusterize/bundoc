import { expect, test } from "bun:test";
import { defaultPdfFilter, resolveConfig } from "./index.ts";

const base = { locales: ["en", "de"], defaultLocale: "en" };

test("pdf config defaults", () => {
  const { pdf } = resolveConfig(base, "/site");
  expect(pdf.paper).toEqual({ width: "210mm", height: "297mm" });
  expect(pdf.margin).toEqual({
    top: "22mm",
    right: "18mm",
    bottom: "20mm",
    left: "18mm",
  });
  expect(pdf.title).toEqual({ en: "Documentation", de: "Documentation" });
  expect(pdf.fileName).toBe("handbook");
  expect(pdf.themeEntry).toBe("/site/theme/pdf.tsx");
  expect(pdf.cover).toBe(true);
  expect(pdf.toc).toBe(true);
  expect(pdf.filter).toBe(defaultPdfFilter);
});

test("pdf config: landscape swaps the format, margins merge", () => {
  const { pdf } = resolveConfig(
    {
      ...base,
      pdf: { format: "Letter", landscape: true, margin: { top: "1in" } },
    },
    "/site",
  );
  expect(pdf.paper).toEqual({ width: "11in", height: "8.5in" });
  expect(pdf.margin.top).toBe("1in");
  expect(pdf.margin.bottom).toBe("20mm");
});

test("pdf config: per-locale titles fall back to the first entry", () => {
  const { pdf } = resolveConfig(
    { ...base, pdf: { title: { en: "Handbook" } } },
    "/site",
  );
  expect(pdf.title).toEqual({ en: "Handbook", de: "Handbook" });
});

test("pdf config: unknown format throws", () => {
  expect(() =>
    resolveConfig({ ...base, pdf: { format: "B5" as "A4" } }, "/site"),
  ).toThrow(/unknown pdf.format/);
});

test("defaultPdfFilter honours frontmatter.pdf", () => {
  const row = { route: "/", locale: "en", title: "", fallback: false };
  expect(defaultPdfFilter({ ...row, frontmatter: {} })).toBe(true);
  expect(defaultPdfFilter({ ...row, frontmatter: { pdf: false } })).toBe(false);
});
