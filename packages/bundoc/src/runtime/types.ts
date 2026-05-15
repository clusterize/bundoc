import type { ComponentType } from "react";

export type Heading = { id: string; text: string; level: number };

export type ManifestRouteEntry = {
  route: string;
  locale: string;
  importerKey: string;
  importer: () => Promise<MdxModule>;
  frontmatter: Record<string, unknown>;
  title: string;
  fallback: boolean;
};

export type MdxModule = {
  default: ComponentType<Record<string, unknown>>;
  frontmatter?: Record<string, unknown>;
  headings?: Heading[];
};

export type NavNode = {
  route?: string;
  label: string;
  order: number;
  children: NavNode[];
  fallback?: boolean;
  /** Raw filesystem segment (internal lookup key). */
  seg?: string;
  /**
   * Pass-through bag of any extra keys present on the segment's
   * `_meta.json` entry (beyond `label`/`order`/`hidden`). Bundoc does
   * not interpret these — themes own them (e.g. `icon`, `badge`,
   * `kind: "separator"`).
   *
   * Mirror of `NavNode.meta` in `content/manifest.ts` — keep both in
   * sync. See `runtime/types.test.ts` for the type-level guard.
   */
  meta?: Record<string, unknown>;
};

export type Manifest = {
  locales: string[];
  defaultLocale: string;
  basePath: string;
  routes: Record<string, Record<string, ManifestRouteEntry>>;
  nav: Record<string, NavNode>;
  order: Record<string, string[]>;
};
