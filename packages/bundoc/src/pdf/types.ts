// Types shared by the Node orchestrator (`bundoc pdf`) and the browser-side
// print app. Everything here crosses `page.evaluate`, so it must stay
// JSON-serialisable.

/** One docs page in the handbook. */
export type PdfSection = {
  /** Position in the handbook (0-based, nav order). */
  index: number;
  /** Element id of the section; also its named destination in the PDF. */
  anchor: string;
  route: string;
  locale: string;
  title: string;
  frontmatter: Record<string, unknown>;
  /** True when the page is default-locale content shown under another locale. */
  fallback: boolean;
  /** Labels of the nav groups above this page, outermost first. */
  breadcrumbs: string[];
};

/** A node of the handbook's table of contents (mirrors the nav tree). */
export type PdfOutlineNode = {
  label: string;
  /** Section index when the node is a page; absent for pure groups. */
  section?: number;
  /** The nav node's `_meta.json` extras (see `NavNode.meta`). */
  meta?: Record<string, unknown>;
  children: PdfOutlineNode[];
};

export type PdfPaper = {
  width: string;
  height: string;
  margin: { top: string; right: string; bottom: string; left: string };
};

export type PdfDocumentJob = {
  kind: "document";
  locale: string;
  title: string;
  paper: PdfPaper;
  /** ISO timestamp of the run (passed to the cover). */
  generatedAt: string;
  cover: boolean;
  toc: boolean;
  sections: PdfSection[];
  outline: PdfOutlineNode[];
  /**
   * 1-based start page per section index. `null` on the first pass, when
   * page numbers aren't known yet (the TOC renders placeholders).
   */
  pageNumbers: number[] | null;
  /** Bumped on every pass so the tree remounts from scratch. */
  pass: number;
};

export type PdfSheetKind = "cover" | "toc" | "page";

export type PdfSheet = {
  pageNumber: number;
  kind: PdfSheetKind;
  /** Section index for `kind: "page"`, otherwise null. */
  section: number | null;
};

export type PdfOverlayJob = {
  kind: "overlay";
  locale: string;
  title: string;
  paper: PdfPaper;
  sections: PdfSection[];
  pageNumbers: number[];
  sheets: PdfSheet[];
  totalPages: number;
};

export type PdfJob = PdfDocumentJob | PdfOverlayJob;

/** Element id of the TOC section (also a named destination). */
export const TOC_ANCHOR = "bundoc-pdf-toc";

export function sectionAnchor(index: number): string {
  return `bundoc-pdf-s${index}`;
}

declare global {
  interface Window {
    __bundocPdf?: { render: (job: PdfJob) => Promise<void> };
  }
}
