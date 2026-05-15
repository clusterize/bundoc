import { mkdir } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import type { ResolvedConfig } from "../config/index.ts";
import { type DiscoveryResult, discoverContent } from "../content/discover.ts";
import {
  buildManifest,
  emitManifestModule,
  type Manifest,
} from "../content/manifest.ts";
import { compileMdx } from "../mdx/compile.ts";
import { buildSearchIndexes } from "../search/build-index.ts";

export type CachePaths = {
  /** `.bundoc/cache/` absolute. */
  dir: string;
  pagesDir: string;
  /** Where per-locale search indexes are persisted (`<locale>.json`). */
  searchDir: string;
  manifestPath: string;
  themePath: string;
  mdxComponentsPath: string;
  entryPath: string;
  htmlPath: string;
};

export function cachePaths(config: ResolvedConfig): CachePaths {
  const dir = join(config.rootDir, ".bundoc", "cache");
  return {
    dir,
    pagesDir: join(dir, "pages"),
    searchDir: join(dir, "search"),
    manifestPath: join(dir, "manifest.ts"),
    themePath: join(dir, "theme.tsx"),
    mdxComponentsPath: join(dir, "mdx-components.tsx"),
    entryPath: join(dir, "entry.tsx"),
    htmlPath: join(dir, "index.html"),
  };
}

/**
 * Discover content, compile each MDX file into a `.tsx` shim in `pages/`,
 * and emit `manifest.ts` whose importers point at those shims (so Bun's
 * bundler only ever sees plain TSX).
 */
export async function rebuildContentCache(opts: {
  config: ResolvedConfig;
  development?: boolean;
}): Promise<{
  manifest: Manifest;
  paths: CachePaths;
  discovery: DiscoveryResult;
}> {
  const { config, development = false } = opts;
  const paths = cachePaths(config);
  await mkdir(paths.pagesDir, { recursive: true });

  const discovery = await discoverContent({
    contentDir: config.contentDir,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
  });

  // Compile each unique source file to a TSX shim. The shim filename is
  // derived from a stable hash of the source path so route changes don't
  // shuffle filenames.
  const sourceToShim = new Map<string, string>();
  const compileTasks: Promise<void>[] = [];
  const highlighting = config.mdx.highlighting;
  for (const entry of discovery.entries) {
    if (sourceToShim.has(entry.sourcePath)) continue;
    const shimName = shimFilename(entry.sourcePath);
    const shimPath = join(paths.pagesDir, shimName);
    sourceToShim.set(entry.sourcePath, shimPath);
    compileTasks.push(
      compileSingle(entry.sourcePath, shimPath, development, highlighting),
    );
  }
  await Promise.all(compileTasks);

  // Build manifest pointing at shim files, NOT the source paths.
  const manifest = await buildManifest({
    discovery,
    contentDir: config.contentDir,
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    basePath: config.basePath,
  });
  // Swap source paths to shim paths for the manifest emission step.
  for (const byLocale of Object.values(manifest.routes)) {
    for (const entry of Object.values(byLocale)) {
      const shim = sourceToShim.get(entry.sourcePath);
      if (shim) entry.sourcePath = shim;
    }
  }
  const manifestSrc = emitManifestModule({
    manifest,
    contentDir: config.contentDir,
    emittedFromDir: paths.dir,
  });
  await Bun.write(paths.manifestPath, manifestSrc);

  // Build per-locale search indexes. We pass the original (non-shimmed)
  // source paths so the extractor sees the user's MDX, not the compiled JSX.
  // The manifest swap above re-pointed entries to shim files, so look up the
  // originals from the discovery result.
  const sourceCache = new Map<string, string>();
  const sourceLoader = async (p: string) => {
    let s = sourceCache.get(p);
    if (s === undefined) {
      s = await Bun.file(p).text();
      sourceCache.set(p, s);
    }
    return s;
  };
  // Build a sibling manifest whose entries still point at originals.
  const sourceManifest: Manifest = {
    ...manifest,
    routes: Object.fromEntries(
      Object.entries(manifest.routes).map(([route, byLocale]) => [
        route,
        Object.fromEntries(
          Object.entries(byLocale).map(([locale, entry]) => {
            const original = discovery.routes.get(route)?.entries[locale];
            return [
              locale,
              original ? { ...entry, sourcePath: original.sourcePath } : entry,
            ];
          }),
        ),
      ]),
    ),
  };
  await buildSearchIndexes({
    manifest: sourceManifest,
    sourceLoader,
    outDir: paths.searchDir,
    filter: config.search.filter,
  });

  return { manifest, paths, discovery };
}

/** Recompile a single MDX file. Used by the watcher on content changes. */
export async function recompileSingle(opts: {
  config: ResolvedConfig;
  sourcePath: string;
  development?: boolean;
}): Promise<void> {
  const { config, sourcePath, development = false } = opts;
  const paths = cachePaths(config);
  const shimPath = join(paths.pagesDir, shimFilename(sourcePath));
  await compileSingle(
    sourcePath,
    shimPath,
    development,
    config.mdx.highlighting,
  );
}

async function compileSingle(
  sourcePath: string,
  shimPath: string,
  development: boolean,
  highlighting: ResolvedConfig["mdx"]["highlighting"],
) {
  const source = await Bun.file(sourcePath).text();
  const compiled = await compileMdx(source, { development, highlighting });
  await Bun.write(shimPath, compiled);
}

function shimFilename(sourcePath: string): string {
  const h = Bun.hash(sourcePath).toString(16);
  // Add the source basename for debuggability.
  const base = basename(sourcePath, ".mdx").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${base}.${h}.tsx`;
}

async function writeThemeShim(config: ResolvedConfig) {
  const paths = cachePaths(config);
  const rel = toImportSpec(paths.dir, config.themeEntry);
  await Bun.write(
    paths.themePath,
    `export { default } from ${JSON.stringify(rel)};\n`,
  );
}

async function writeMdxComponentsShim(config: ResolvedConfig) {
  const paths = cachePaths(config);
  if (
    config.mdxComponentsEntry &&
    (await Bun.file(config.mdxComponentsEntry).exists())
  ) {
    const rel = toImportSpec(paths.dir, config.mdxComponentsEntry);
    await Bun.write(
      paths.mdxComponentsPath,
      `export { default } from ${JSON.stringify(rel)};\n`,
    );
  } else {
    await Bun.write(paths.mdxComponentsPath, `export default {};\n`);
  }
}

async function writeEntry(config: ResolvedConfig) {
  const paths = cachePaths(config);
  const src = `// AUTO-GENERATED by bundoc — do not edit
import { mountBundoc } from "@clusterize/bundoc/runtime";
import manifest from "./manifest.ts";
import ThemeApp from "./theme.tsx";
import mdxComponents from "./mdx-components.tsx";

mountBundoc({ manifest, ThemeApp, mdxComponents });
`;
  await Bun.write(paths.entryPath, src);
}

async function writeHtml(
  config: ResolvedConfig,
  opts: { title?: string } = {},
) {
  const paths = cachePaths(config);
  const title = opts.title ?? "bundoc";
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./entry.tsx"></script>
  </body>
</html>
`;
  await Bun.write(paths.htmlPath, html);
}

/** First-run scaffold: build everything from scratch. */
export async function regenerateAll(opts: {
  config: ResolvedConfig;
  development?: boolean;
}): Promise<CachePaths> {
  const { config } = opts;
  const paths = cachePaths(config);
  await mkdir(paths.dir, { recursive: true });
  await Promise.all([
    rebuildContentCache(opts),
    writeThemeShim(config),
    writeMdxComponentsShim(config),
    writeEntry(config),
    writeHtml(config),
  ]);
  return paths;
}

function toImportSpec(fromDir: string, target: string): string {
  let rel = relative(fromDir, target).split(sep).join("/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
