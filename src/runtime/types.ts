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
};

export type Manifest = {
  locales: string[];
  defaultLocale: string;
  basePath: string;
  routes: Record<string, Record<string, ManifestRouteEntry>>;
  nav: Record<string, NavNode>;
  order: Record<string, string[]>;
};
