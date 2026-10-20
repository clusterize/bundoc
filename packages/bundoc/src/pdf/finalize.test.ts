import { expect, test } from "bun:test";
import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  type PDFRef,
} from "pdf-lib";
import { addOutline, readNamedDestinations, stampOverlay } from "./finalize.ts";

async function docWithPages(n: number): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([595, 842]);
  return doc;
}

test("readNamedDestinations: catalog /Dests (Chromium style)", async () => {
  const doc = await docWithPages(3);
  const [p0, , p2] = doc.getPages();
  doc.catalog.set(
    PDFName.of("Dests"),
    doc.context.obj({
      a: [p0?.ref, "XYZ", 0, 842, 0],
      b: [p2?.ref, "XYZ", 0, 842, 0],
    }),
  );
  const dests = readNamedDestinations(doc);
  expect([...dests]).toEqual([
    ["a", 0],
    ["b", 2],
  ]);
});

test("readNamedDestinations: /Names name tree", async () => {
  const doc = await docWithPages(2);
  const p1 = doc.getPages()[1];
  const tree = doc.context.obj({
    Names: [
      PDFHexString.fromText("x"),
      doc.context.obj({ D: [p1?.ref, "Fit"] }),
    ],
  });
  doc.catalog.set(PDFName.of("Names"), doc.context.obj({ Dests: tree }));
  expect(readNamedDestinations(doc).get("x")).toBe(1);
});

test("addOutline: nested items with counts and page targets", async () => {
  const doc = await docWithPages(4);
  addOutline(doc, [
    { title: "Intro", pageIndex: 0, children: [] },
    {
      title: "Guides",
      pageIndex: 1,
      children: [
        { title: "A", pageIndex: 1, children: [] },
        { title: "Ä/ü", pageIndex: 3, children: [] },
      ],
    },
  ]);
  const saved = await PDFDocument.load(await doc.save());
  const outlines = saved.catalog.lookup(PDFName.of("Outlines"), PDFDict);
  expect(outlines.lookup(PDFName.of("Count"))?.toString()).toBe("4");
  const first = outlines.lookup(PDFName.of("First"), PDFDict);
  const second = first.lookup(PDFName.of("Next"), PDFDict);
  const title = second.lookup(PDFName.of("Title")) as PDFHexString;
  expect(title.decodeText()).toBe("Guides");
  const child = second.lookup(PDFName.of("Last"), PDFDict);
  expect((child.lookup(PDFName.of("Title")) as PDFHexString).decodeText()).toBe(
    "Ä/ü",
  );
  const dest = child.lookup(PDFName.of("Dest"));
  const target = (dest as unknown as { get(i: number): PDFRef }).get(0);
  expect(target.toString()).toBe(saved.getPage(3).ref.toString());
  expect(saved.catalog.get(PDFName.of("PageMode"))?.toString()).toBe(
    "/UseOutlines",
  );
});

test("stampOverlay: rejects mismatched page counts", async () => {
  const doc = await docWithPages(2);
  const overlay = await docWithPages(3);
  await expect(stampOverlay(doc, overlay)).rejects.toThrow(
    /3 pages, content has 2/,
  );
});

test("stampOverlay: draws overlay page i onto page i, skipping blank ones", async () => {
  const doc = await docWithPages(3);
  const overlay = await docWithPages(3);
  // Page 1 of the overlay stays blank (no content stream).
  overlay.getPages()[0]?.drawText("header 1");
  overlay.getPages()[2]?.drawText("header 3");
  await stampOverlay(doc, overlay);
  const saved = await PDFDocument.load(await doc.save());
  const counts = saved
    .getPages()
    .map(
      (page) =>
        page.node
          .Resources()
          ?.lookupMaybe(PDFName.of("XObject"), PDFDict)
          ?.keys().length ?? 0,
    );
  expect(counts).toEqual([1, 0, 1]);
});
