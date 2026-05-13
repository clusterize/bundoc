import { create, load, type Orama, search as oramaSearch } from "@orama/orama";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useManifest } from "../runtime/providers.tsx";
import { useLocale } from "./hooks.ts";

/** A single search hit, normalised for theme rendering. */
export type SearchHit = {
  /** Logical route to navigate to. */
  route: string;
  /** Locale this hit came from. */
  locale: string;
  /** Top-level page title. */
  title: string;
  /** Section heading text (or "" if the hit is the page itself). */
  heading: string;
  /** Anchor id for the heading (use as `#${anchor}` to deep-link). */
  anchor: string;
  /** Snippet of body text for the section. */
  text: string;
  /** Orama relevance score (higher = better). */
  score: number;
};

export type SearchClient = {
  /** Run a query against the loaded index. */
  query: (
    term: string,
    opts?: { limit?: number; tolerance?: number },
  ) => Promise<SearchHit[]>;
  /** True once the index for the current locale has been fetched + restored. */
  ready: boolean;
  /** True while a fetch is in-flight. */
  loading: boolean;
  /** Last error from fetch/restore, or null. */
  error: Error | null;
};

// Per-locale index cache shared across hook instances.
const dbCache = new Map<string, Promise<Orama<typeof SCHEMA>>>();

const SCHEMA = {
  title: "string",
  heading: "string",
  text: "string",
  route: "string",
  locale: "string",
  anchor: "string",
} as const;

/** URL where the runtime expects to find the index for a given locale. */
function indexUrl(locale: string, basePath: string): string {
  const prefix = basePath === "/" || basePath === "" ? "" : basePath;
  return `${prefix}/_bundoc/search/${encodeURIComponent(locale)}.json`;
}

async function loadDb(
  locale: string,
  basePath: string,
): Promise<Orama<typeof SCHEMA>> {
  let promise = dbCache.get(locale);
  if (promise) return promise;
  promise = (async () => {
    const res = await fetch(indexUrl(locale, basePath));
    if (!res.ok) {
      throw new Error(
        `bundoc: failed to load search index for "${locale}" (${res.status})`,
      );
    }
    const data = await res.json();
    const db = create({ schema: SCHEMA }) as Orama<typeof SCHEMA>;
    load(db, data);
    return db;
  })();
  dbCache.set(locale, promise);
  // Drop on failure so the next call can retry.
  promise.catch(() => dbCache.delete(locale));
  return promise;
}

/**
 * Returns a lazy search client scoped to the current locale. The first call
 * to `query()` fetches the persisted index; subsequent calls are in-memory.
 */
export function useSearchIndex(): SearchClient {
  const manifest = useManifest();
  const { locale } = useLocale();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [db, setDb] = useState<Orama<typeof SCHEMA> | null>(null);

  // Reset state when the locale changes. `locale` is the trigger, not a value
  // read inside — biome's exhaustive-deps rule misreads this as redundant.
  // biome-ignore lint/correctness/useExhaustiveDependencies: locale is the intentional trigger
  useEffect(() => {
    setReady(false);
    setDb(null);
    setError(null);
  }, [locale]);

  const ensureLoaded = useCallback(async () => {
    if (db) return db;
    setLoading(true);
    try {
      const loaded = await loadDb(locale, manifest.basePath);
      setDb(loaded);
      setReady(true);
      setError(null);
      return loaded;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [db, locale, manifest.basePath]);

  const query = useCallback<SearchClient["query"]>(
    async (term, opts) => {
      const trimmed = term.trim();
      if (!trimmed) return [];
      const loaded = await ensureLoaded();
      const r = await oramaSearch(loaded, {
        term: trimmed,
        properties: ["title", "heading", "text"],
        boost: { title: 2, heading: 1.5, text: 1 },
        tolerance: opts?.tolerance ?? 1,
        limit: opts?.limit ?? 10,
      });
      return r.hits.map((h) => {
        const doc = h.document as unknown as {
          route: string;
          locale: string;
          title: string;
          heading: string;
          anchor: string;
          text: string;
        };
        return {
          route: doc.route,
          locale: doc.locale,
          title: doc.title,
          heading: doc.heading,
          anchor: doc.anchor,
          text: doc.text,
          score: h.score,
        };
      });
    },
    [ensureLoaded],
  );

  return useMemo(
    () => ({ query, ready, loading, error }),
    [query, ready, loading, error],
  );
}
