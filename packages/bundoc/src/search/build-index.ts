import { create, insertMultiple, save } from "@orama/orama";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { extractSearchable } from "./extract.ts";
import type { Manifest } from "../content/manifest.ts";

export type IndexedDoc = {
  /** Stable id (route + locale + section index). */
  id: string;
  route: string;
  locale: string;
  title: string;
  /** Closest heading text for this row (may be ""). */
  heading: string;
  /** Anchor id for the heading, if any. */
  anchor: string;
  /** Section text (or whole body if no sections). */
  text: string;
};

/**
 * Schema we feed Orama. `text` is the main searchable field; `title` and
 * `heading` get a higher boost at query time. Filterable scalars (route,
 * locale, anchor) sit alongside.
 */
export const ORAMA_SCHEMA = {
  title: "string",
  heading: "string",
  text: "string",
  route: "string",
  locale: "string",
  anchor: "string",
} as const;

export type SearchIndexFiles = {
  /** locale → absolute path to persisted index file. */
  files: Record<string, string>;
};

/**
 * Build one Orama index per locale and persist to `outDir/<locale>.json`.
 * Reads each MDX source (we already have the path in the manifest), runs
 * the plaintext extractor, and inserts one row per heading-section.
 */
export async function buildSearchIndexes(opts: {
  manifest: Manifest;
  /** Map of `sourcePath` → original MDX source text. We keep the read here so the caller can cache. */
  sourceLoader: (sourcePath: string) => Promise<string>;
  outDir: string;
}): Promise<SearchIndexFiles> {
  const { manifest, sourceLoader, outDir } = opts;
  await mkdir(outDir, { recursive: true });

  const files: Record<string, string> = {};
  for (const locale of manifest.locales) {
    const docs = await collectDocsForLocale({ manifest, locale, sourceLoader });
    const db = create({ schema: ORAMA_SCHEMA });
    if (docs.length > 0) {
      await insertMultiple(db, docs as unknown as Record<string, unknown>[]);
    }
    const serialized = JSON.stringify(await save(db));
    const out = join(outDir, `${locale}.json`);
    await Bun.write(out, serialized);
    files[locale] = out;
  }
  return { files };
}

async function collectDocsForLocale(opts: {
  manifest: Manifest;
  locale: string;
  sourceLoader: (sourcePath: string) => Promise<string>;
}): Promise<IndexedDoc[]> {
  const { manifest, locale, sourceLoader } = opts;
  const seen = new Set<string>();
  const docs: IndexedDoc[] = [];

  for (const [route, byLocale] of Object.entries(manifest.routes)) {
    const entry = byLocale[locale];
    // Skip fallback rows — they'd duplicate default-locale content under
    // every other locale and bloat the index. (The runtime can fall through
    // to the default-locale index on miss.)
    if (!entry || entry.fallback) continue;

    const sourcePath = entry.sourcePath;
    if (seen.has(`${locale}::${sourcePath}`)) continue;
    seen.add(`${locale}::${sourcePath}`);

    const source = await sourceLoader(sourcePath);
    const extracted = extractSearchable(source, entry.title);

    if (extracted.sections.length === 0) {
      docs.push({
        id: `${locale}::${route}::0`,
        route,
        locale,
        title: extracted.title,
        heading: "",
        anchor: "",
        text: extracted.body,
      });
      continue;
    }

    extracted.sections.forEach((section, i) => {
      docs.push({
        id: `${locale}::${route}::${i}`,
        route,
        locale,
        title: extracted.title,
        heading: section.heading,
        anchor: section.id,
        text: section.text || extracted.body,
      });
    });
  }

  return docs;
}
