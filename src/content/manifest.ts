import { join, dirname, relative, sep } from "node:path";
import { Glob } from "bun";
import type { DiscoveryResult, DiscoveredEntry } from "./discover.ts";

export type Heading = { id: string; text: string; level: number };

export type ManifestRouteEntry = {
  route: string;
  locale: string;
  /** Source file path (absolute) — used by importer thunks. */
  sourcePath: string;
  /** Frontmatter parsed at discovery time. */
  frontmatter: Record<string, unknown>;
  /** Display title (frontmatter.title || derived). */
  title: string;
  /** True when this is the synthesized fallback (default-locale content surfaced under another locale). */
  fallback?: boolean;
};

export type NavNode = {
  /** Link route. May be undefined for category-only nodes. */
  route?: string;
  /** Display label. */
  label: string;
  /** Sort order. Lower comes first. Defaults to Infinity. */
  order: number;
  /** Children (for directory nodes). */
  children: NavNode[];
  /** True if this node is the current locale (filled at lookup time). */
  fallback?: boolean;
};

export type Manifest = {
  locales: string[];
  defaultLocale: string;
  basePath: string;
  /**
   * `routes[route][locale] → entry`. Includes synthetic fallback rows so every
   * route has every locale resolvable (with `fallback: true` when synthesized).
   */
  routes: Record<string, Record<string, ManifestRouteEntry>>;
  /** Per-locale navigation tree. */
  nav: Record<string, NavNode>;
  /** Ordered list of routes per locale (for prev/next). */
  order: Record<string, string[]>;
};

type MetaJson = {
  /** Map of segment → label override or {label, order, hidden}. */
  [key: string]:
    | string
    | { label?: string; order?: number; hidden?: boolean };
};

/**
 * Build the manifest from a `DiscoveryResult`. Synthesizes fallback entries so
 * every (route × locale) is resolvable (with `fallback: true`).
 */
export async function buildManifest(opts: {
  discovery: DiscoveryResult;
  contentDir: string;
  locales: string[];
  defaultLocale: string;
  basePath: string;
}): Promise<Manifest> {
  const { discovery, contentDir, locales, defaultLocale, basePath } = opts;

  // 1. Build routes map (with fallback synthesis).
  const routes: Record<string, Record<string, ManifestRouteEntry>> = {};
  for (const [route, bucket] of discovery.routes) {
    const localeMap: Record<string, ManifestRouteEntry> = {};
    const defaultEntry = bucket.entries[defaultLocale];
    for (const locale of locales) {
      const entry = bucket.entries[locale];
      if (entry) {
        localeMap[locale] = toManifestEntry(entry, locale, false);
      } else if (defaultEntry) {
        localeMap[locale] = toManifestEntry(defaultEntry, locale, true);
      }
      // If neither: leave unset; theme treats as 404 for that locale.
    }
    routes[route] = localeMap;
  }

  // 2. Load _meta.json files (per directory).
  const metaByDir = await loadMetaFiles(contentDir);

  // 3. Build nav tree per locale.
  const nav: Record<string, NavNode> = {};
  const order: Record<string, string[]> = {};
  for (const locale of locales) {
    const tree = buildNavTree({
      routes,
      locale,
      metaByDir,
    });
    nav[locale] = tree;
    order[locale] = flattenOrder(tree);
  }

  return {
    locales,
    defaultLocale,
    basePath,
    routes,
    nav,
    order,
  };
}

function toManifestEntry(
  entry: DiscoveredEntry,
  locale: string,
  fallback: boolean,
): ManifestRouteEntry {
  const fm = entry.frontmatter ?? {};
  const title =
    typeof fm.title === "string"
      ? fm.title
      : deriveTitleFromRoute(entry.route);
  return {
    route: entry.route,
    locale,
    sourcePath: entry.sourcePath,
    frontmatter: fm,
    title,
    fallback: fallback || undefined,
  };
}

function deriveTitleFromRoute(route: string): string {
  if (route === "/") return "Home";
  const seg = route.split("/").filter(Boolean).pop() ?? "";
  return seg
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadMetaFiles(contentDir: string): Promise<Map<string, MetaJson>> {
  const out = new Map<string, MetaJson>();
  const glob = new Glob("**/_meta.json");
  for await (const file of glob.scan({ cwd: contentDir, dot: false })) {
    const dir = dirname(file).split(sep).join("/");
    const dirKey = dir === "." ? "" : dir;
    try {
      const json = await Bun.file(join(contentDir, file)).json();
      out.set(dirKey, json as MetaJson);
    } catch {
      // ignore malformed _meta.json
    }
  }
  return out;
}

type RouteParts = {
  /** Path segments excluding leading slash. `[]` for `/`. */
  segments: string[];
  /** The final segment used as a "name" in nav (for index.mdx, this is "" → category itself). */
};

function splitRoute(route: string): string[] {
  if (route === "/") return [];
  return route.replace(/^\//, "").split("/");
}

function buildNavTree(opts: {
  routes: Record<string, Record<string, ManifestRouteEntry>>;
  locale: string;
  metaByDir: Map<string, MetaJson>;
}): NavNode {
  const { routes, locale, metaByDir } = opts;
  const root: NavNode = {
    label: "",
    order: 0,
    children: [],
  };

  // For each route, walk segments and create/update nav nodes.
  for (const [route, byLocale] of Object.entries(routes)) {
    const entry = byLocale[locale];
    if (!entry) continue; // route not available in this locale even with fallback
    const segments = splitRoute(route);
    if (segments.length === 0) {
      // root index.mdx → fold into the root node itself; we'll store its
      // metadata via a synthetic child labelled "Home" so themes can link.
      root.children.unshift({
        route: "/",
        label: entry.title,
        order: numberOr(entry.frontmatter, "order", -Infinity),
        children: [],
        fallback: entry.fallback,
      });
      continue;
    }
    insertRoute(root, segments, entry, metaByDir);
  }

  sortTree(root);
  return root;
}

function insertRoute(
  root: NavNode,
  segments: string[],
  entry: ManifestRouteEntry,
  metaByDir: Map<string, MetaJson>,
): void {
  let cursor = root;
  let dirPath = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    if (isLast) {
      // Leaf node — attach the route here.
      const existing = findChildBySegment(cursor, seg);
      const meta = metaByDir.get(dirPath);
      const segMeta = readSegMeta(meta, seg);
      if (existing) {
        existing.route = entry.route;
        existing.label = segMeta.label ?? existing.label ?? entry.title;
        existing.order = segMeta.order ?? existing.order;
        existing.fallback = entry.fallback;
      } else {
        cursor.children.push({
          route: entry.route,
          label: segMeta.label ?? entry.title,
          order: segMeta.order ?? numberOr(entry.frontmatter, "order", Infinity),
          children: [],
          fallback: entry.fallback,
        });
      }
    } else {
      let child = findChildBySegment(cursor, seg);
      if (!child) {
        const meta = metaByDir.get(dirPath);
        const segMeta = readSegMeta(meta, seg);
        child = {
          label: segMeta.label ?? humanise(seg),
          order: segMeta.order ?? Infinity,
          children: [],
        };
        cursor.children.push(child);
      }
      cursor = child;
      dirPath = dirPath ? `${dirPath}/${seg}` : seg;
    }
  }
}

function findChildBySegment(node: NavNode, seg: string): NavNode | undefined {
  // We don't store the segment explicitly, so derive from `route` for leaves
  // and `label` for categories — but to be safe, we tag categories by trailing
  // path segment via a parallel map. Simpler: use last segment of route, or
  // the humanised label match. For correctness, prefer matching by trailing
  // segment of node.route (leaf) or by category label === humanise(seg).
  for (const c of node.children) {
    if (c.route) {
      const last = c.route.replace(/^\//, "").split("/").pop();
      if (last === seg) return c;
    } else if (c.label === humanise(seg)) {
      return c;
    }
  }
  return undefined;
}

function readSegMeta(
  meta: MetaJson | undefined,
  seg: string,
): { label?: string; order?: number; hidden?: boolean } {
  if (!meta) return {};
  const raw = meta[seg];
  if (raw === undefined) return {};
  if (typeof raw === "string") return { label: raw };
  return raw;
}

function numberOr(fm: Record<string, unknown>, key: string, fallback: number): number {
  const v = fm[key];
  if (typeof v === "number") return v;
  // Check sidebar.order
  const sidebar = fm.sidebar;
  if (sidebar && typeof sidebar === "object" && key === "order") {
    const sv = (sidebar as Record<string, unknown>).order;
    if (typeof sv === "number") return sv;
  }
  return fallback;
}

function humanise(seg: string): string {
  return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortTree(node: NavNode): void {
  node.children.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label);
  });
  for (const c of node.children) sortTree(c);
}

function flattenOrder(node: NavNode): string[] {
  const out: string[] = [];
  const walk = (n: NavNode) => {
    if (n.route) out.push(n.route);
    for (const c of n.children) walk(c);
  };
  for (const c of node.children) walk(c);
  return out;
}

/**
 * Emit the JS source for the virtual `bundoc:manifest` module. Importer
 * thunks dynamic-import each MDX file so per-page chunks split out.
 */
export function emitManifestModule(opts: {
  manifest: Manifest;
  contentDir: string;
  /** Where this module will live (so imports can be relativized). */
  emittedFromDir: string;
}): string {
  const { manifest, emittedFromDir } = opts;

  // Collect unique source paths and assign import keys.
  const imports: { key: string; path: string }[] = [];
  const sourceToKey = new Map<string, string>();
  for (const byLocale of Object.values(manifest.routes)) {
    for (const entry of Object.values(byLocale)) {
      if (sourceToKey.has(entry.sourcePath)) continue;
      const key = `__page_${imports.length}`;
      sourceToKey.set(entry.sourcePath, key);
      imports.push({ key, path: entry.sourcePath });
    }
  }

  const importerLines = imports
    .map((imp) => {
      const rel = toImportSpecifier(emittedFromDir, imp.path);
      return `  ${imp.key}: () => import(${JSON.stringify(rel)}),`;
    })
    .join("\n");

  // Build a JSON-safe manifest (omit functions; replace sourcePath with importer key).
  const exportable = {
    locales: manifest.locales,
    defaultLocale: manifest.defaultLocale,
    basePath: manifest.basePath,
    routes: Object.fromEntries(
      Object.entries(manifest.routes).map(([route, byLocale]) => [
        route,
        Object.fromEntries(
          Object.entries(byLocale).map(([locale, entry]) => [
            locale,
            {
              route: entry.route,
              locale: entry.locale,
              importerKey: sourceToKey.get(entry.sourcePath)!,
              frontmatter: entry.frontmatter,
              title: entry.title,
              fallback: entry.fallback ?? false,
            },
          ]),
        ),
      ]),
    ),
    nav: manifest.nav,
    order: manifest.order,
  };

  return `// AUTO-GENERATED by bundoc — do not edit
const importers = {
${importerLines}
};

const manifest = ${JSON.stringify(exportable, null, 2)};

// Attach importer functions to each route entry under \`importer\`.
for (const route of Object.keys(manifest.routes)) {
  const byLocale = manifest.routes[route];
  for (const locale of Object.keys(byLocale)) {
    const entry = byLocale[locale];
    entry.importer = importers[entry.importerKey];
  }
}

export default manifest;
export const locales = manifest.locales;
export const defaultLocale = manifest.defaultLocale;
export const basePath = manifest.basePath;
export const routes = manifest.routes;
export const nav = manifest.nav;
export const order = manifest.order;
`;
}

function toImportSpecifier(fromDir: string, target: string): string {
  let rel = relative(fromDir, target).split(sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}
