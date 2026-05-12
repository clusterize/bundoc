import { Glob } from "bun";
import { basename, dirname, join, relative, sep } from "node:path";
import matter from "gray-matter";

export type DiscoveredEntry = {
  /** Source absolute path. */
  sourcePath: string;
  /** Path relative to contentDir (POSIX-style). */
  relPath: string;
  /** Logical route, e.g. `/`, `/faq/installation`. */
  route: string;
  /** Locale parsed from filename, or `undefined` if no suffix (→ default locale). */
  locale: string | undefined;
  /** Raw frontmatter object (best-effort, may be {}). */
  frontmatter: Record<string, unknown>;
};

export type DiscoveredRoute = {
  route: string;
  /** Map of locale → entry. */
  entries: Record<string, DiscoveredEntry>;
};

export type DiscoveryResult = {
  routes: Map<string, DiscoveredRoute>;
  /** All entries flat (useful for watchers). */
  entries: DiscoveredEntry[];
};

/**
 * Walk `contentDir`, parse filenames, group by route. Reads frontmatter for
 * each MDX file (cheap up-front; gives us titles/sidebar metadata without
 * compiling MDX).
 */
export async function discoverContent(opts: {
  contentDir: string;
  locales: string[];
  defaultLocale: string;
}): Promise<DiscoveryResult> {
  const { contentDir, locales, defaultLocale } = opts;
  const localeSet = new Set(locales);
  const glob = new Glob("**/*.mdx");
  const entries: DiscoveredEntry[] = [];
  const routes = new Map<string, DiscoveredRoute>();

  for await (const file of glob.scan({ cwd: contentDir, dot: false })) {
    if (shouldIgnore(file)) continue;

    const sourcePath = join(contentDir, file);
    const relPath = file.split(sep).join("/");
    const parsed = parseFilename(relPath, localeSet);
    if (parsed === undefined) {
      // Bad locale suffix; skip silently. (Could surface as a diagnostic.)
      continue;
    }
    const { route, locale } = parsed;
    const effectiveLocale = locale ?? defaultLocale;

    let frontmatter: Record<string, unknown> = {};
    try {
      const text = await Bun.file(sourcePath).text();
      const fm = matter(text);
      frontmatter = (fm.data ?? {}) as Record<string, unknown>;
    } catch {
      // ignore frontmatter parse errors here — surface during compile.
    }

    const entry: DiscoveredEntry = {
      sourcePath,
      relPath,
      route,
      locale,
      frontmatter,
    };
    entries.push(entry);

    let bucket = routes.get(route);
    if (!bucket) {
      bucket = { route, entries: {} };
      routes.set(route, bucket);
    }
    bucket.entries[effectiveLocale] = entry;
  }

  return { routes, entries };
}

/**
 * Returns `undefined` if a locale suffix is present but isn't in `localeSet`.
 * Returns `{ route, locale: undefined }` for files without a locale suffix.
 */
export function parseFilename(
  relPath: string,
  localeSet: Set<string>,
): { route: string; locale: string | undefined } | undefined {
  // Strip extension
  if (!relPath.endsWith(".mdx")) return { route: toRoute(relPath), locale: undefined };
  const noExt = relPath.slice(0, -4);

  // Detect locale suffix `.<loc>` on the basename.
  const dir = dirname(noExt);
  const base = basename(noExt);
  const dotIdx = base.lastIndexOf(".");
  let nameWithoutLocale = base;
  let locale: string | undefined;
  if (dotIdx !== -1) {
    const candidate = base.slice(dotIdx + 1);
    if (localeSet.has(candidate)) {
      nameWithoutLocale = base.slice(0, dotIdx);
      locale = candidate;
    } else {
      // Looks like a locale (`foo.xx.mdx`) but xx isn't in our list → invalid.
      // Heuristic: only treat as bad if the segment is short (2-5 chars).
      if (candidate.length >= 2 && candidate.length <= 8 && /^[a-zA-Z][a-zA-Z0-9-]*$/.test(candidate)) {
        return undefined;
      }
    }
  }

  const finalRel = dir === "." ? nameWithoutLocale : `${dir}/${nameWithoutLocale}`;
  return { route: toRoute(finalRel), locale };
}

function toRoute(relWithoutExt: string): string {
  // POSIX
  const norm = relWithoutExt.split(sep).join("/");
  // index.mdx → directory
  if (norm === "index") return "/";
  if (norm.endsWith("/index")) return "/" + norm.slice(0, -"/index".length);
  return "/" + norm;
}

function shouldIgnore(relPath: string): boolean {
  // Ignore files/dirs starting with `_` or `.`.
  for (const segment of relPath.split("/")) {
    if (segment.startsWith("_") || segment.startsWith(".")) return true;
  }
  return false;
}

/** Convenience: relative-from-cwd label for log messages. */
export function relFromCwd(p: string): string {
  return relative(process.cwd(), p) || ".";
}
