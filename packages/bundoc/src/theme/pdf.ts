import { createContext, type ReactNode, useContext } from "react";

// Public types for the PDF theme module (`theme/pdf.tsx`, see
// `pdf.themeEntry`). Every export is optional; bundoc falls back to
// built-in defaults for anything the theme leaves out.

/** A docs page as seen by the PDF components. */
export type PdfPageInfo = {
  route: string;
  locale: string;
  title: string;
  frontmatter: Record<string, unknown>;
  /** True when the page is default-locale content shown under another locale. */
  fallback: boolean;
  /** Labels of the nav groups above the page, outermost first. */
  breadcrumbs: string[];
  /** 1-based PDF page the docs page starts on (null while still unknown). */
  pageNumber: number | null;
};

export type PdfCoverProps = {
  /** Handbook title (`pdf.title`). */
  title: string;
  locale: string;
  /** ISO timestamp of the `bundoc pdf` run. */
  generatedAt: string;
};

export type PdfTocEntry = {
  label: string;
  /**
   * Extra keys from the nav node's `_meta.json` entry (icons, localized
   * labels, …), passed through like `NavNode.meta`.
   */
  meta?: Record<string, unknown>;
  /** In-document link target (`#…`); always set — groups link to their first page. */
  href: string;
  /** 1-based PDF page, or null on the measuring pass (render a placeholder). */
  pageNumber: number | null;
  /** 0 for top-level entries. */
  depth: number;
  /** The page behind this entry, or null for a group without its own page. */
  page: PdfPageInfo | null;
  children: PdfTocEntry[];
};

export type PdfTocProps = {
  title: string;
  locale: string;
  entries: PdfTocEntry[];
};

export type PdfPageProps = {
  page: PdfPageInfo;
  /** The rendered MDX content. */
  children: ReactNode;
};

/** Props for `PdfHeader` and `PdfFooter`, rendered once per PDF page. */
export type PdfMarginalProps = {
  /** Handbook title (`pdf.title`). */
  title: string;
  locale: string;
  /** 1-based physical page number. */
  pageNumber: number;
  totalPages: number;
  /** What this PDF page shows. */
  kind: "cover" | "toc" | "page";
  /** The docs page on this PDF page (`kind: "page"` only). */
  page: PdfPageInfo | null;
};

export const PdfContext = createContext<boolean>(false);

/**
 * True while rendering for `bundoc pdf`. Use it to render interactive
 * components statically (accordions expanded, all tabs shown, …).
 * Plain CSS works too: the PDF app sets `data-bundoc-pdf` on `<html>`
 * and renders with `print` media.
 */
export function usePdf(): boolean {
  return useContext(PdfContext);
}
