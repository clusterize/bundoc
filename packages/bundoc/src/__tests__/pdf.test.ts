import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { loadConfig } from "../config/index.ts";
import { readNamedDestinations } from "../pdf/finalize.ts";
import { type GeneratedPdf, generatePdfs } from "../pdf/generate.ts";
import { sectionAnchor, TOC_ANCHOR } from "../pdf/types.ts";

// End-to-end `bundoc pdf` against packages/docs. Needs Playwright's
// Chromium; skipped locally when it can't launch (`bunx playwright install
// chromium`), but fails on CI.

const docsDir = resolve(import.meta.dir, "../../../docs");
let outDir = "";
let results: GeneratedPdf[] = [];
const chromium = await canLaunchChromium();

async function canLaunchChromium(): Promise<boolean> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    await browser.close();
    return true;
  } catch (err) {
    // CI installs Chromium, so a skip there means the install broke.
    if (process.env.CI) throw err;
    return false;
  }
}

beforeAll(async () => {
  if (!chromium) return;
  outDir = await mkdtemp(join(tmpdir(), "bundoc-pdf-"));
  const config = await loadConfig(docsDir);
  results = await generatePdfs({ config, out: outDir });
}, 120_000);

afterAll(async () => {
  if (outDir) await rm(outDir, { recursive: true, force: true });
});

async function load(locale: string) {
  const r = results.find((x) => x.locale === locale);
  if (!r) throw new Error(`no pdf for ${locale}`);
  return PDFDocument.load(await Bun.file(r.path).bytes());
}

/** Start page of every section, read back from the PDF's named destinations. */
function sectionStarts(doc: PDFDocument): number[] {
  const dests = readNamedDestinations(doc);
  const starts: number[] = [];
  for (let i = 0; dests.has(sectionAnchor(i)); i++) {
    starts.push(dests.get(sectionAnchor(i)) as number);
  }
  return starts;
}

test.skipIf(!chromium)("one handbook per locale", () => {
  expect(results.map((r) => r.locale)).toEqual(["en", "de"]);
  for (const r of results) {
    expect(r.path).toEndWith(`handbook.${r.locale}.pdf`);
  }
});

test.skipIf(!chromium)(
  "every docs page starts on its own PDF page",
  async () => {
    for (const locale of ["en", "de"]) {
      const doc = await load(locale);
      const starts = sectionStarts(doc);
      expect(starts.length).toBeGreaterThan(10);
      // Cover is page 0, TOC starts on page 1, then sections in order —
      // strictly increasing means no two docs pages share a PDF page.
      expect(readNamedDestinations(doc).get(TOC_ANCHOR)).toBe(1);
      expect(starts[0]).toBeGreaterThan(1);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i] as number).toBeGreaterThan(starts[i - 1] as number);
      }
      expect(doc.getPageCount()).toBeGreaterThan(starts.at(-1) as number);
    }
  },
);

test.skipIf(!chromium)(
  "non-default locales include fallback pages",
  async () => {
    const en = sectionStarts(await load("en"));
    const de = sectionStarts(await load("de"));
    expect(de.length).toBe(en.length);
  },
);

test.skipIf(!chromium)("metadata, outline and A4 pages", async () => {
  const doc = await load("de");
  expect(doc.getTitle()).toBe("Documentation");
  expect(doc.catalog.get(PDFName.of("Outlines"))).toBeDefined();
  const { width, height } = doc.getPage(0).getSize();
  // A4 is 595.28 × 841.89 pt; Chromium rounds slightly.
  expect(Math.round(width)).toBe(595);
  expect(Math.round(height)).toBe(842);
});

test.skipIf(!chromium)(
  "internal links resolve inside the document",
  async () => {
    const doc = await load("en");
    let internal = 0;
    let local = 0;
    for (const page of doc.getPages()) {
      const annots = page.node.Annots();
      if (!annots) continue;
      for (let i = 0; i < annots.size(); i++) {
        const a = annots.lookup(i);
        const s = a?.toString() ?? "";
        if (s.includes("/Dest")) internal++;
        if (s.includes("127.0.0.1")) local++;
      }
    }
    expect(internal).toBeGreaterThan(20);
    expect(local).toBe(0);
  },
);
