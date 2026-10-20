import { type ComponentType, type ReactNode, useMemo } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PageOutlet } from "../../runtime/outlet.tsx";
import { StaticPageModuleProvider } from "../../runtime/page-module.tsx";
import {
  ManifestProvider,
  MdxComponentsProvider,
  RouteMatchProvider,
} from "../../runtime/providers.tsx";
import { buildHref, resolveRoute } from "../../runtime/route-resolver.ts";
import { StaticRouterProvider, stripBasePath } from "../../runtime/router.tsx";
import type { Manifest, MdxModule } from "../../runtime/types.ts";
import {
  PdfContext,
  type PdfCoverProps,
  type PdfMarginalProps,
  type PdfPageInfo,
  type PdfPageProps,
  type PdfTocEntry,
  type PdfTocProps,
} from "../../theme/pdf.ts";
import { firstSection } from "../plan.ts";
import {
  type PdfDocumentJob,
  type PdfJob,
  type PdfOutlineNode,
  type PdfOverlayJob,
  type PdfPaper,
  type PdfSection,
  TOC_ANCHOR,
} from "../types.ts";
import {
  DefaultPdfCover,
  DefaultPdfFooter,
  DefaultPdfHeader,
  DefaultPdfPage,
  DefaultPdfToc,
} from "./defaults.tsx";

/** Named exports of the theme's PDF module; all optional. */
export type PdfThemeModule = {
  PdfCover?: ComponentType<PdfCoverProps>;
  PdfToc?: ComponentType<PdfTocProps>;
  PdfPage?: ComponentType<PdfPageProps>;
  PdfHeader?: ComponentType<PdfMarginalProps>;
  PdfFooter?: ComponentType<PdfMarginalProps>;
};

type Theme = Required<PdfThemeModule>;

export type MountPdfOptions = {
  manifest: Manifest;
  mdxComponents?: Record<string, unknown>;
  theme: PdfThemeModule;
};

/**
 * Entry of the print app that `bundoc pdf` drives through Playwright.
 * Exposes `window.__bundocPdf.render(job)`, which renders the job and
 * resolves once fonts and images have settled and links are rewritten.
 */
export function mountBundocPdf(opts: MountPdfOptions): void {
  const { manifest, mdxComponents } = opts;
  const theme: Theme = {
    PdfCover: opts.theme.PdfCover ?? DefaultPdfCover,
    PdfToc: opts.theme.PdfToc ?? DefaultPdfToc,
    PdfPage: opts.theme.PdfPage ?? DefaultPdfPage,
    PdfHeader: opts.theme.PdfHeader ?? DefaultPdfHeader,
    PdfFooter: opts.theme.PdfFooter ?? DefaultPdfFooter,
  };
  const html = document.documentElement;
  html.dataset.bundocPdf = "";
  html.classList.remove("dark");
  html.style.colorScheme = "light";
  const target = document.getElementById("root") ?? document.body;
  const root = createRoot(target);
  const style = document.createElement("style");
  document.head.append(style);

  window.__bundocPdf = {
    async render(job: PdfJob) {
      html.lang = job.locale;
      style.textContent =
        job.kind === "document"
          ? documentCss(job.paper)
          : overlayCss(job.paper);
      const mods =
        job.kind === "document"
          ? await Promise.all(job.sections.map((s) => loadModule(manifest, s)))
          : [];
      flushSync(() => {
        root.render(
          <PdfContext.Provider value={true}>
            <ManifestProvider manifest={manifest}>
              <MdxComponentsProvider components={mdxComponents}>
                {job.kind === "document" ? (
                  <DocumentView
                    key={job.pass}
                    job={job}
                    mods={mods}
                    theme={theme}
                    manifest={manifest}
                  />
                ) : (
                  <OverlayView job={job} theme={theme} manifest={manifest} />
                )}
              </MdxComponentsProvider>
            </ManifestProvider>
          </PdfContext.Provider>,
        );
      });
      await settle();
      if (job.kind === "document") rewriteLinks(job, manifest);
      await settle();
    },
  };
}

function loadModule(manifest: Manifest, s: PdfSection): Promise<MdxModule> {
  const entry = manifest.routes[s.route]?.[s.locale];
  if (!entry) throw new Error(`bundoc pdf: no manifest entry for ${s.route}`);
  return entry.importer();
}

function documentCss(paper: PdfPaper): string {
  const m = paper.margin;
  return `@page { size: ${paper.width} ${paper.height}; margin: ${m.top} ${m.right} ${m.bottom} ${m.left}; }
@page bundoc-cover { margin: 0; }
.bundoc-pdf-break { break-before: page; }
/* Chromium clips the page area at its exact (fractional) width but lays
   out on whole pixels, which shaves the right border off full-width
   boxes (tables, cards, callouts). A 1px inset keeps borders clear. */
.bundoc-pdf-break { padding-inline: 1px; }
.bundoc-pdf-cover { page: bundoc-cover; position: relative; height: calc(${paper.height} - 1mm); overflow: hidden; }
.bundoc-pdf-anchors { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; }
:where(h1, h2, h3, h4, h5, h6) { break-after: avoid; }
:where(img, figure, tr) { break-inside: avoid; }`;
}

// Header/footer sheets: one per PDF page, transparent except for the
// marginals, so they can be stamped on top of the content render.
function overlayCss(paper: PdfPaper): string {
  const m = paper.margin;
  return `@page { size: ${paper.width} ${paper.height}; margin: 0; }
html, body, #root { background: transparent !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }
.bundoc-pdf-sheet { position: relative; width: ${paper.width}; height: calc(${paper.height} - 1mm); overflow: hidden; }
.bundoc-pdf-sheet +.bundoc-pdf-sheet { break-before: page; }
.bundoc-pdf-header, .bundoc-pdf-footer { position: absolute; left: 0; right: 0; box-sizing: border-box; padding: 0 ${m.right} 0 ${m.left}; }
.bundoc-pdf-header { top: 0; height: ${m.top}; }
.bundoc-pdf-footer { top: calc(${paper.height} - ${m.bottom}); height: calc(${m.bottom} - 1mm); }`;
}

/** Router + route match for a (route, locale) pair, so theme hooks work. */
function Scope({
  manifest,
  route,
  locale,
  mod,
  children,
}: {
  manifest: Manifest;
  route: string;
  locale: string;
  mod?: MdxModule;
  children: ReactNode;
}) {
  const pathname = buildHref({
    route,
    locale,
    defaultLocale: manifest.defaultLocale,
    basePath: manifest.basePath,
  });
  return (
    <StaticRouterProvider pathname={pathname} basePath={manifest.basePath}>
      <RouteMatchProvider>
        {mod ? (
          <StaticPageModuleProvider mod={mod}>
            {children}
          </StaticPageModuleProvider>
        ) : (
          children
        )}
      </RouteMatchProvider>
    </StaticRouterProvider>
  );
}

function pageInfo(s: PdfSection, pageNumbers: number[] | null): PdfPageInfo {
  return {
    route: s.route,
    locale: s.locale,
    title: s.title,
    frontmatter: s.frontmatter,
    fallback: s.fallback,
    breadcrumbs: s.breadcrumbs,
    pageNumber: pageNumbers?.[s.index] ?? null,
  };
}

function tocEntries(
  nodes: PdfOutlineNode[],
  job: PdfDocumentJob,
  depth: number,
): PdfTocEntry[] {
  return nodes.flatMap((node) => {
    const first = firstSection(node);
    const section = first === undefined ? undefined : job.sections[first];
    if (!section) return [];
    const own =
      node.section === undefined ? undefined : job.sections[node.section];
    return [
      {
        label: node.label,
        meta: node.meta,
        href: `#${section.anchor}`,
        pageNumber: job.pageNumbers?.[section.index] ?? null,
        depth,
        page: own ? pageInfo(own, job.pageNumbers) : null,
        children: tocEntries(node.children, job, depth + 1),
      },
    ];
  });
}

function DocumentView({
  job,
  mods,
  theme,
  manifest,
}: {
  job: PdfDocumentJob;
  mods: MdxModule[];
  theme: Theme;
  manifest: Manifest;
}) {
  const { PdfCover, PdfToc, PdfPage } = theme;
  const entries = useMemo(() => tocEntries(job.outline, job, 0), [job]);
  return (
    <>
      {job.cover && (
        <section className="bundoc-pdf-cover">
          <Scope manifest={manifest} route="/" locale={job.locale}>
            <PdfCover
              title={job.title}
              locale={job.locale}
              generatedAt={job.generatedAt}
            />
          </Scope>
        </section>
      )}
      {job.toc && (
        <section id={TOC_ANCHOR} className="bundoc-pdf-break">
          <Scope manifest={manifest} route="/" locale={job.locale}>
            <PdfToc title={job.title} locale={job.locale} entries={entries} />
          </Scope>
        </section>
      )}
      {job.sections.map((s, i) => (
        <section
          key={s.anchor}
          id={s.anchor}
          className="bundoc-pdf-break"
          data-bundoc-pdf-section={s.index}
        >
          <Scope
            manifest={manifest}
            route={s.route}
            locale={s.locale}
            mod={mods[i]}
          >
            <PdfPage page={pageInfo(s, job.pageNumbers)}>
              <PageOutlet />
            </PdfPage>
          </Scope>
        </section>
      ))}
      {/* Chromium only emits named destinations for link targets; these
          make every section (and the TOC) one, whatever the theme's TOC
          renders. They're how bundoc learns each section's start page. */}
      <div className="bundoc-pdf-anchors" aria-hidden="true">
        {job.toc && <a href={`#${TOC_ANCHOR}`}>.</a>}
        {job.sections.map((s) => (
          <a key={s.anchor} href={`#${s.anchor}`}>
            .
          </a>
        ))}
      </div>
    </>
  );
}

function OverlayView({
  job,
  theme,
  manifest,
}: {
  job: PdfOverlayJob;
  theme: Theme;
  manifest: Manifest;
}) {
  const { PdfHeader, PdfFooter } = theme;
  return (
    <>
      {job.sheets.map((sheet) => {
        const section =
          sheet.section === null ? undefined : job.sections[sheet.section];
        const props: PdfMarginalProps = {
          title: job.title,
          locale: job.locale,
          pageNumber: sheet.pageNumber,
          totalPages: job.totalPages,
          kind: sheet.kind,
          page: section ? pageInfo(section, job.pageNumbers) : null,
        };
        return (
          <div key={sheet.pageNumber} className="bundoc-pdf-sheet">
            <Scope
              manifest={manifest}
              route={section?.route ?? "/"}
              locale={job.locale}
            >
              <div className="bundoc-pdf-header">
                <PdfHeader {...props} />
              </div>
              <div className="bundoc-pdf-footer">
                <PdfFooter {...props} />
              </div>
            </Scope>
          </div>
        );
      })}
    </>
  );
}

/**
 * Make links work inside the PDF:
 * - element ids inside each section get the section anchor as prefix,
 *   since pages share one document and ids like `#overview` collide;
 * - links to included pages (and their headings) become `#…` links,
 *   which Chromium turns into in-document jumps;
 * - heading permalinks (links to their own heading) are dropped;
 * - links to excluded pages or local files lose their
 *   href (they'd point at the throwaway render server);
 * - external links stay untouched.
 */
function rewriteLinks(job: PdfDocumentJob, manifest: Manifest): void {
  const byRoute = new Map(job.sections.map((s) => [s.route, s]));
  for (const s of job.sections) {
    const el = document.getElementById(s.anchor);
    if (!el) continue;
    for (const node of el.querySelectorAll("[id]")) {
      node.id = `${s.anchor}--${node.id}`;
    }
  }
  const targetId = (s: PdfSection, fragment: string): string => {
    const id = `${s.anchor}--${fragment}`;
    return fragment && document.getElementById(id) ? id : s.anchor;
  };

  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const raw = a.getAttribute("href") ?? "";
    if (a.closest(".bundoc-pdf-anchors")) continue;
    if (raw.startsWith("#")) {
      if (raw.startsWith("#bundoc-pdf-")) continue;
      const owner = a.closest<HTMLElement>("[data-bundoc-pdf-section]");
      const s = owner
        ? job.sections[Number(owner.dataset.bundocPdfSection)]
        : undefined;
      if (!s) continue;
      const id = targetId(s, safeDecode(raw.slice(1)));
      // Heading permalinks (`<h2 id="x"><a href="#x">`) would jump to
      // themselves; drop them.
      if (id !== s.anchor && a.parentElement?.closest(`#${CSS.escape(id)}`)) {
        a.removeAttribute("href");
        continue;
      }
      a.setAttribute("href", `#${id}`);
      continue;
    }
    let url: URL;
    try {
      url = new URL(raw, window.location.href);
    } catch {
      continue;
    }
    if (url.origin !== window.location.origin) continue;
    const match = resolveRoute(
      stripBasePath(url.pathname, manifest.basePath),
      manifest,
    );
    // Match by route only: a handbook holds one version of each page, and
    // unprefixed links on fallback (default-locale) pages resolve to the
    // default locale even though the page lives in this handbook.
    const s = match.notFound ? undefined : byRoute.get(match.route);
    a.removeAttribute("target");
    if (!s) {
      a.removeAttribute("href");
      continue;
    }
    a.setAttribute("href", `#${targetId(s, safeDecode(url.hash.slice(1)))}`);
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Wait for layout, fonts and images (lazy ones are forced eager). */
async function settle(): Promise<void> {
  await nextFrame();
  await nextFrame();
  await document.fonts.ready;
  const pending = Array.from(document.images)
    .map((img) => {
      if (img.loading === "lazy") img.loading = "eager";
      if (img.complete) return null;
      return new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      });
    })
    .filter(Boolean);
  await Promise.race([
    Promise.all(pending),
    new Promise((resolve) => setTimeout(resolve, 15_000)),
  ]);
  await document.fonts.ready;
  await nextFrame();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
