import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { create, load, search } from "@orama/orama";
import type { SearchablePage } from "../config/index.ts";
import { discoverContent } from "../content/discover.ts";
import { buildManifest, type Manifest } from "../content/manifest.ts";
import { buildSearchIndexes, ORAMA_SCHEMA } from "./build-index.ts";

async function buildDocsManifest(): Promise<{
  manifest: Manifest;
}> {
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
  return { manifest };
}

function restoreJson(json: string) {
  const db = create({ schema: ORAMA_SCHEMA });
  load(db, JSON.parse(json));
  return db;
}

test("build → persist → restore → search roundtrip", async () => {
  const { manifest } = await buildDocsManifest();
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
    const r = await search(db, {
      term: "installation",
      properties: ["title", "heading", "text"],
    });
    expect(r.count).toBeGreaterThan(0);
    const routes = new Set(
      r.hits.map((h) => (h.document as unknown as { route: string }).route),
    );
    expect(routes.has("/getting-started/installation")).toBe(true);

    // Typo tolerance: 1-char delete should still match.
    const fuzzy = await search(db, { term: "instalation", tolerance: 1 });
    expect(fuzzy.count).toBeGreaterThan(0);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("German index searches German content", async () => {
  const { manifest } = await buildDocsManifest();
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

test("default predicate honours frontmatter.search: false", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
    });
    const db = restoreJson(await Bun.file(files.en!).text());
    // Roadmap has `search: false` in its frontmatter (see
    // packages/docs/content/reference/roadmap.mdx) — the default
    // predicate skips it.
    const r = await search(db, { term: "roadmap" });
    const routes = new Set(
      r.hits.map((h) => (h.document as unknown as { route: string }).route),
    );
    expect(routes.has("/reference/roadmap")).toBe(false);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("custom predicate can exclude by route prefix", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
      filter: (p) => !p.route.startsWith("/api/"),
    });
    const db = restoreJson(await Bun.file(files.en!).text());
    const r = await search(db, { term: "hook", properties: ["text", "title"] });
    const routes = r.hits.map(
      (h) => (h.document as unknown as { route: string }).route,
    );
    for (const route of routes) {
      expect(route.startsWith("/api/")).toBe(false);
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("default config folds description into the index", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
    });
    const db = restoreJson(await Bun.file(files.en!).text());
    // "freshly" appears only in project-structure.mdx's description.
    const r = await search(db, {
      term: "freshly",
      properties: ["text"],
    });
    const routes = new Set(
      r.hits.map((h) => (h.document as unknown as { route: string }).route),
    );
    expect(routes.has("/getting-started/project-structure")).toBe(true);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("explicit empty frontmatterFields opts out of description indexing", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
      frontmatterFields: [],
    });
    const db = restoreJson(await Bun.file(files.en!).text());
    const r = await search(db, {
      term: "freshly",
      properties: ["text"],
    });
    expect(r.count).toBe(0);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("description folding applies per-locale", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
    });
    const db = restoreJson(await Bun.file(files.de!).text());
    // "Bun-natives" appears only in the German index page's description.
    const r = await search(db, {
      term: "Bun-natives",
      properties: ["text"],
    });
    expect(r.count).toBeGreaterThan(0);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("extending frontmatterFields preserves description indexing", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  try {
    const { files } = await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
      frontmatterFields: ["description", "keywords"],
    });
    const db = restoreJson(await Bun.file(files.en!).text());
    const r = await search(db, {
      term: "freshly",
      properties: ["text"],
    });
    const routes = new Set(
      r.hits.map((h) => (h.document as unknown as { route: string }).route),
    );
    expect(routes.has("/getting-started/project-structure")).toBe(true);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);

test("predicate never receives fallback rows", async () => {
  const { manifest } = await buildDocsManifest();
  const out = await mkdtemp(join(tmpdir(), "bundoc-search-"));
  const seen: SearchablePage[] = [];
  try {
    await buildSearchIndexes({
      manifest,
      sourceLoader: (p) => Bun.file(p).text(),
      outDir: out,
      filter: (page) => {
        seen.push(page);
        return true;
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    // German locale has fallback rows; if any leaked past the
    // fallback-skip step we'd see fallback: true here.
    for (const page of seen) {
      expect(page.fallback).toBe(false);
    }
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}, 10_000);
