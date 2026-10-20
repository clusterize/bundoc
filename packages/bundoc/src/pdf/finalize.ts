import {
  PDFArray,
  PDFDict,
  type PDFDocument,
  PDFHexString,
  PDFName,
  PDFNull,
  type PDFObject,
  PDFRef,
  PDFString,
} from "pdf-lib";

/**
 * Resolve named destinations to 0-based page indexes. Chromium writes one
 * named destination per element id that some `<a href="#id">` in the
 * document points at, into the catalog's `/Dests` dict (PDF 1.1 style);
 * the `/Names` → `/Dests` name tree (PDF 1.2+) is read too for safety.
 */
export function readNamedDestinations(doc: PDFDocument): Map<string, number> {
  const pageIndex = new Map<string, number>();
  doc.getPages().forEach((p, i) => {
    pageIndex.set(p.ref.toString(), i);
  });
  const out = new Map<string, number>();
  const add = (name: string, value: PDFObject | undefined) => {
    let dest = value ? doc.context.lookup(value) : undefined;
    if (dest instanceof PDFDict) dest = dest.lookup(PDFName.of("D"));
    if (!(dest instanceof PDFArray)) return;
    const ref = dest.get(0);
    if (!(ref instanceof PDFRef)) return;
    const idx = pageIndex.get(ref.toString());
    if (idx !== undefined) out.set(name, idx);
  };

  const dests = doc.catalog.lookup(PDFName.of("Dests"));
  if (dests instanceof PDFDict) {
    for (const [key, value] of dests.entries()) {
      add(key.decodeText(), value);
    }
  }
  const names = doc.catalog.lookup(PDFName.of("Names"));
  const tree =
    names instanceof PDFDict ? names.lookup(PDFName.of("Dests")) : undefined;
  if (tree instanceof PDFDict) walkNameTree(doc, tree, add);
  return out;
}

function walkNameTree(
  doc: PDFDocument,
  node: PDFDict,
  add: (name: string, value: PDFObject | undefined) => void,
) {
  const names = node.lookup(PDFName.of("Names"));
  if (names instanceof PDFArray) {
    for (let i = 0; i + 1 < names.size(); i += 2) {
      const key = names.lookup(i);
      if (key instanceof PDFString || key instanceof PDFHexString) {
        add(key.decodeText(), names.get(i + 1));
      }
    }
  }
  const kids = node.lookup(PDFName.of("Kids"));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i);
      if (kid instanceof PDFDict) walkNameTree(doc, kid, add);
    }
  }
}

/**
 * Draw page `i` of `overlay` on top of page `i` of `doc`. Both documents
 * must have the same page count and size (the overlay is the
 * header/footer render, transparent everywhere else).
 */
export async function stampOverlay(
  doc: PDFDocument,
  overlay: PDFDocument,
): Promise<void> {
  const pages = doc.getPages();
  if (overlay.getPageCount() !== pages.length) {
    throw new Error(
      `bundoc pdf: header/footer render has ${overlay.getPageCount()} pages, content has ${pages.length}`,
    );
  }
  // Pages without a content stream are blank (e.g. no header on the
  // cover) and can't be embedded anyway.
  const sources = overlay.getPages();
  const nonBlank = sources.filter((p) => p.node.Contents() !== undefined);
  const embeddedList = await doc.embedPages(nonBlank);
  const embedded = sources.map((p) => {
    const i = nonBlank.indexOf(p);
    return i === -1 ? undefined : embeddedList[i];
  });
  pages.forEach((page, i) => {
    const e = embedded[i];
    if (!e) return;
    const { width, height } = page.getSize();
    page.drawPage(e, { x: 0, y: 0, width, height });
  });
}

export type OutlineItem = {
  title: string;
  /** 0-based page index. */
  pageIndex: number;
  children: OutlineItem[];
};

/**
 * Write a PDF document outline ("bookmarks" in most viewers) and ask
 * viewers to show it on open. All levels start expanded.
 */
export function addOutline(doc: PDFDocument, items: OutlineItem[]): void {
  if (items.length === 0) return;
  const ctx = doc.context;
  const pages = doc.getPages();
  const rootRef = ctx.nextRef();

  // Returns the number of descendants (for the parent's /Count).
  const build = (
    level: OutlineItem[],
    parentRef: PDFRef,
  ): { first: PDFRef; last: PDFRef; count: number } => {
    const refs = level.map(() => ctx.nextRef());
    let count = 0;
    level.forEach((item, i) => {
      const page = pages[item.pageIndex] ?? pages[0];
      if (!page) return;
      const dict = ctx.obj({
        Title: PDFHexString.fromText(item.title),
        Parent: parentRef,
        Dest: ctx.obj([page.ref, PDFName.of("XYZ"), PDFNull, PDFNull, PDFNull]),
      });
      const prev = refs[i - 1];
      const next = refs[i + 1];
      if (prev) dict.set(PDFName.of("Prev"), prev);
      if (next) dict.set(PDFName.of("Next"), next);
      if (item.children.length > 0) {
        const sub = build(item.children, refs[i] as PDFRef);
        dict.set(PDFName.of("First"), sub.first);
        dict.set(PDFName.of("Last"), sub.last);
        dict.set(PDFName.of("Count"), ctx.obj(sub.count));
        count += sub.count;
      }
      count += 1;
      ctx.assign(refs[i] as PDFRef, dict);
    });
    return {
      first: refs[0] as PDFRef,
      last: refs[refs.length - 1] as PDFRef,
      count,
    };
  };

  const top = build(items, rootRef);
  ctx.assign(
    rootRef,
    ctx.obj({
      Type: "Outlines",
      First: top.first,
      Last: top.last,
      Count: top.count,
    }),
  );
  doc.catalog.set(PDFName.of("Outlines"), rootRef);
  doc.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}
