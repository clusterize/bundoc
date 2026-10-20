import { mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import type { Browser, Page } from "playwright";
import type { ResolvedConfig } from "../config/index.ts";
import type { Manifest } from "../content/manifest.ts";
import { joinPublicPath } from "../server/build.ts";
import { cachePaths, regenerateAll, writePdfShell } from "../server/cache.ts";
import { loadBunfigPlugins } from "../server/load-bunfig-plugins.ts";
import {
  addOutline,
  type OutlineItem,
  readNamedDestinations,
  stampOverlay,
} from "./finalize.ts";
import {
  buildLocalePlan,
  buildSheets,
  firstSection,
  type LocalePlan,
} from "./plan.ts";
import {
  type PdfDocumentJob,
  type PdfJob,
  type PdfOutlineNode,
  type PdfPaper,
  TOC_ANCHOR,
} from "./types.ts";

/** TOC page numbers can shift the layout they measure; give up after this many passes. */
const MAX_PASSES = 4;

export type GeneratePdfOptions = {
  config: ResolvedConfig;
  /** Output directory, relative to the project root. */
  out: string;
  /** Limit to these locales. Default: every configured locale. */
  locales?: string[];
};

export type GeneratedPdf = { locale: string; path: string; pages: number };

export async function generatePdfs(
  opts: GeneratePdfOptions,
): Promise<GeneratedPdf[]> {
  const { config } = opts;
  const locales = opts.locales ?? config.locales;
  for (const l of locales) {
    if (!config.locales.includes(l)) {
      throw new Error(
        `bundoc pdf: unknown locale "${l}" (configured: ${config.locales.join(", ")})`,
      );
    }
  }

  const { manifest } = await regenerateAll({ config, development: false });
  await writePdfShell(config);
  const appDir = await buildPrintApp(config);
  const server = servePrintApp(config, appDir);
  const playwright = await loadPlaywright(config.rootDir);
  let browser: Browser;
  try {
    browser = await playwright.chromium.launch();
  } catch (err) {
    server.stop(true);
    throw new Error(
      `bundoc pdf: could not launch Chromium. Install it with \`bunx playwright install chromium\`.\n${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const outDir = resolve(config.rootDir, opts.out);
  await mkdir(outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const results: GeneratedPdf[] = [];
  try {
    const origin = `http://127.0.0.1:${server.port}`;
    for (const locale of locales) {
      const page = await browser.newPage();
      try {
        await page.emulateMedia({ media: "print", colorScheme: "light" });
        await page.goto(`${origin}${joinPublicPath(config.basePath)}`);
        await page.waitForFunction(() => window.__bundocPdf !== undefined);
        const bytes = await renderLocale({
          page,
          config,
          manifest,
          locale,
          generatedAt,
        });
        const path = join(outDir, `${config.pdf.fileName}.${locale}.pdf`);
        await Bun.write(path, bytes.data);
        results.push({ locale, path, pages: bytes.pages });
        console.log(
          `bundoc pdf → ${join(opts.out, `${config.pdf.fileName}.${locale}.pdf`)} (${bytes.pages} pages)`,
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.stop(true);
  }
  return results;
}

async function renderLocale(opts: {
  page: Page;
  config: ResolvedConfig;
  manifest: Manifest;
  locale: string;
  generatedAt: string;
}): Promise<{ data: Uint8Array; pages: number }> {
  const { page, config, manifest, locale, generatedAt } = opts;
  const pdf = config.pdf;
  const plan = buildLocalePlan({ manifest, locale, filter: pdf.filter });
  if (plan.sections.length === 0) {
    throw new Error(
      `bundoc pdf: no pages left for locale "${locale}" after pdf.filter`,
    );
  }
  const title = pdf.title[locale] ?? "Documentation";
  const paper: PdfPaper = { ...pdf.paper, margin: pdf.margin };
  const job: PdfDocumentJob = {
    kind: "document",
    locale,
    title,
    paper,
    generatedAt,
    cover: pdf.cover,
    toc: pdf.toc,
    sections: plan.sections,
    outline: plan.outline,
    pageNumbers: null,
    pass: 0,
  };

  // Render, measure where each section starts, and re-render with real
  // TOC page numbers until the numbers stop moving (normally 2 passes).
  let doc: PDFDocument | undefined;
  let starts: number[] = [];
  let tocStart: number | null = null;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    job.pass = pass;
    await render(page, job);
    doc = await PDFDocument.load(await printPdf(page, false));
    ({ starts, tocStart } = locateSections(doc, plan, pdf.toc));
    const numbers = starts.map((s) => s + 1);
    const settled =
      job.pageNumbers !== null &&
      numbers.every((n, i) => n === job.pageNumbers?.[i]);
    job.pageNumbers = numbers;
    if (!pdf.toc || settled) break;
    if (pass === MAX_PASSES - 1) {
      console.warn(
        `[bundoc] pdf (${locale}): TOC page numbers did not settle after ${MAX_PASSES} passes`,
      );
    }
  }
  if (!doc || !job.pageNumbers) throw new Error("bundoc pdf: render failed");

  const totalPages = doc.getPageCount();
  await render(page, {
    kind: "overlay",
    locale,
    title,
    paper,
    sections: plan.sections,
    pageNumbers: job.pageNumbers,
    sheets: buildSheets({ totalPages, starts, tocStart }),
    totalPages,
  });
  const overlayBytes = await printPdf(page, true);
  if (process.env.BUNDOC_PDF_DEBUG) {
    // Raw renders before stamping — handy when pages don't line up.
    const dir = join(config.rootDir, ".bundoc", "pdf-debug");
    await Bun.write(join(dir, `content.${locale}.pdf`), await doc.save());
    await Bun.write(join(dir, `overlay.${locale}.pdf`), overlayBytes);
  }
  const overlay = await PDFDocument.load(overlayBytes);
  await stampOverlay(doc, overlay);

  addOutline(doc, [
    ...(tocStart !== null
      ? [{ title: tocTitle(locale), pageIndex: tocStart, children: [] }]
      : []),
    ...outlineItems(plan.outline, starts),
  ]);
  doc.setTitle(title, { showInWindowTitleBar: true });
  doc.setLanguage(locale);
  doc.setCreator("bundoc");
  doc.setProducer("bundoc");
  doc.setCreationDate(new Date(generatedAt));
  doc.setModificationDate(new Date(generatedAt));
  return { data: await doc.save(), pages: totalPages };
}

async function render(page: Page, job: PdfJob): Promise<void> {
  await page.evaluate(async (j) => {
    await window.__bundocPdf?.render(j);
  }, job);
}

function printPdf(page: Page, overlay: boolean): Promise<Buffer> {
  return page.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    ...(overlay ? { omitBackground: true } : {}),
  });
}

function locateSections(
  doc: PDFDocument,
  plan: LocalePlan,
  toc: boolean,
): { starts: number[]; tocStart: number | null } {
  const dests = readNamedDestinations(doc);
  const starts = plan.sections.map((s) => {
    const idx = dests.get(s.anchor);
    if (idx === undefined) {
      throw new Error(
        `bundoc pdf: could not locate "${s.route}" (${s.locale}) in the rendered PDF`,
      );
    }
    return idx;
  });
  return { starts, tocStart: toc ? (dests.get(TOC_ANCHOR) ?? null) : null };
}

function outlineItems(
  nodes: PdfOutlineNode[],
  starts: number[],
): OutlineItem[] {
  return nodes.flatMap((node) => {
    const first = firstSection(node);
    if (first === undefined) return [];
    return [
      {
        title: node.label,
        pageIndex: starts[first] ?? 0,
        // A page node's own children are its sub-pages; a group's
        // children are its pages. Either way they're nested bookmarks.
        children: outlineItems(node.children, starts),
      },
    ];
  });
}

// Bookmark label for the TOC itself. Matches the default PdfToc heading;
// themes that rename it only affect the page, not this bookmark.
function tocTitle(locale: string): string {
  const t: Record<string, string> = {
    de: "Inhalt",
    en: "Contents",
    es: "Contenido",
    fr: "Sommaire",
    it: "Indice",
    nl: "Inhoud",
  };
  return t[locale.split("-")[0] ?? ""] ?? "Contents";
}

async function buildPrintApp(config: ResolvedConfig): Promise<string> {
  const paths = cachePaths(config);
  const outDir = join(config.rootDir, ".bundoc", "pdf-app");
  await rm(outDir, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [paths.pdfHtmlPath],
    outdir: outDir,
    target: "browser",
    splitting: true,
    naming: {
      entry: "index.html",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    publicPath: joinPublicPath(config.basePath),
    plugins: await loadBunfigPlugins(config.rootDir),
  });
  if (!result.success) {
    throw new AggregateError(
      result.logs,
      "bundoc pdf: building the print app failed",
    );
  }
  return outDir;
}

/**
 * Serve the print app plus `public/` under the site's basePath, the same
 * way `bundoc preview` serves `dist/` — MDX asset URLs are basePath-prefixed.
 */
function servePrintApp(config: ResolvedConfig, appDir: string) {
  const basePath = config.basePath;
  const publicDir = resolve(config.rootDir, "public");
  return Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      let pathname = decodeURIComponent(new URL(req.url).pathname);
      if (basePath !== "/") {
        if (pathname === basePath || pathname === `${basePath}/`)
          pathname = "/";
        else if (pathname.startsWith(`${basePath}/`))
          pathname = pathname.slice(basePath.length);
        else return new Response("Not found", { status: 404 });
      }
      if (pathname === "/") pathname = "/index.html";
      if (pathname.includes(".."))
        return new Response("Not found", { status: 404 });
      for (const dir of [appDir, publicDir]) {
        const file = Bun.file(join(dir, pathname));
        if (await isFile(join(dir, pathname))) return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },
  });
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

type Playwright = typeof import("playwright");

async function loadPlaywright(rootDir: string): Promise<Playwright> {
  // Resolve from the project first so the site's own Playwright (and its
  // browser revision) wins over whatever bundoc might find.
  for (const from of [rootDir, import.meta.dir]) {
    try {
      return (await import(Bun.resolveSync("playwright", from))) as Playwright;
    } catch {}
  }
  throw new Error(
    "bundoc pdf needs Playwright: `bun add -d playwright && bunx playwright install chromium`",
  );
}
