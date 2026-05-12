import { test, expect } from "bun:test";
import { resolve, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { discoverContent } from "../content/discover.ts";
import { buildManifest } from "../content/manifest.ts";
import { buildSearchIndexes, ORAMA_SCHEMA } from "./build-index.ts";
import { create, load, search } from "@orama/orama";

function restoreJson(json: string) {
  const db = create({ schema: ORAMA_SCHEMA });
  load(db, JSON.parse(json));
  return db;
}

test("build → persist → restore → search roundtrip", async () => {
  const contentDir = resolve(import.meta.dir, "../../../docs/content");
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });

  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
    });
    expect(Object.keys(files).sort()).toEqual(["de", "en"]);

    // Restore the EN index and search.
    const blob = await Bun.file(files.en!).text();
    const db = restoreJson(blob);
    const r = await search(db, { term: "installation", properties: ["title", "heading", "text"] });
    expect(r.count).toBeGreaterThan(0);
    const routes = new Set(r.hits.map((h) => (h.document as unknown as { route: string }).route));
    expect(routes.has("/getting-started/installation")).toBe(true);

    // Typo tolerance: 1-char delete should still match.
    const fuzzy = await search(db, { term: "instalation", tolerance: 1 });
    expect(fuzzy.count).toBeGreaterThan(0);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("German index searches German content", async () => {
  const contentDir = resolve(import.meta.dir, "../../../docs/content");
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });

  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
    });
    const blob = await Bun.file(files.de!).text();
    const db = restoreJson(blob);
    // "Schnellstart" only appears in the German content.
    const r = await search(db, { term: "Schnellstart" });
    expect(r.count).toBeGreaterThan(0);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);
