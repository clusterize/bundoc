import type { PdfablePage } from "../config/index.ts";
import type { Manifest, NavNode } from "../content/manifest.ts";
import {
  type PdfOutlineNode,
  type PdfSection,
  type PdfSheet,
  sectionAnchor,
} from "./types.ts";

export type LocalePlan = {
  locale: string;
  sections: PdfSection[];
  outline: PdfOutlineNode[];
};

/**
 * Walk a locale's nav tree in order and collect the pages that pass
 * `filter`. Groups with no included descendants drop out of the outline.
 * Fallback rows are included (and passed to `filter`), so every locale's
 * handbook covers the full site.
 */
export function buildLocalePlan(opts: {
  manifest: Manifest;
  locale: string;
  filter: (page: PdfablePage) => boolean;
}): LocalePlan {
  const { manifest, locale, filter } = opts;
  const sections: PdfSection[] = [];

  const walk = (node: NavNode, breadcrumbs: string[]): PdfOutlineNode[] => {
    const out: PdfOutlineNode[] = [];
    for (const child of node.children) {
      let section: number | undefined;
      const entry = child.route
        ? manifest.routes[child.route]?.[locale]
        : undefined;
      if (entry) {
        const row: PdfablePage = {
          route: entry.route,
          locale,
          title: entry.title,
          frontmatter: entry.frontmatter,
          fallback: !!entry.fallback,
        };
        if (filter(row)) {
          section = sections.length;
          sections.push({
            index: section,
            anchor: sectionAnchor(section),
            route: entry.route,
            locale,
            title: entry.title,
            frontmatter: entry.frontmatter,
            fallback: !!entry.fallback,
            breadcrumbs,
          });
        }
      }
      const children = walk(child, [...breadcrumbs, child.label]);
      if (section === undefined && children.length === 0) continue;
      out.push({
        label: child.label,
        ...(section !== undefined ? { section } : {}),
        ...(child.meta ? { meta: child.meta } : {}),
        children,
      });
    }
    return out;
  };

  const root = manifest.nav[locale];
  const outline = root ? walk(root, []) : [];
  return { locale, sections, outline };
}

/** First section index under an outline node (the page a group jumps to). */
export function firstSection(node: PdfOutlineNode): number | undefined {
  if (node.section !== undefined) return node.section;
  for (const c of node.children) {
    const s = firstSection(c);
    if (s !== undefined) return s;
  }
  return undefined;
}

/**
 * Describe every physical page: what it shows (cover, TOC or a docs
 * page) and which section it belongs to. `starts` holds the 0-based
 * start page of each section; `tocStart` that of the TOC (or null).
 */
export function buildSheets(opts: {
  totalPages: number;
  starts: number[];
  tocStart: number | null;
}): PdfSheet[] {
  const { totalPages, starts, tocStart } = opts;
  const sheets: PdfSheet[] = [];
  const firstSectionStart = starts[0] ?? totalPages;
  let s = -1;
  for (let i = 0; i < totalPages; i++) {
    while (s + 1 < starts.length && (starts[s + 1] as number) <= i) s++;
    let kind: PdfSheet["kind"];
    if (i >= firstSectionStart) kind = "page";
    else if (tocStart !== null && i >= tocStart) kind = "toc";
    else kind = "cover";
    sheets.push({
      pageNumber: i + 1,
      kind,
      section: kind === "page" ? s : null,
    });
  }
  return sheets;
}
