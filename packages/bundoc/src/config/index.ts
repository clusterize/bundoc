import { resolve } from "node:path";

/**
 * Build-time syntax highlighting via Shiki. When enabled, `<pre><code>`
 * blocks are turned into Shiki output with dual light/dark themes
 * (CSS-variable based; `html.dark` toggles the active theme).
 */
export type MdxHighlightingConfig =
  | boolean
  | {
      /** Theme name for light mode. Default: `github-light`. */
      light?: string;
      /** Theme name for dark mode. Default: `github-dark`. */
      dark?: string;
    };

export type BundocMdxConfig = {
  /** Build-time syntax highlighting via Shiki. Default: off. */
  highlighting?: MdxHighlightingConfig;
};

/**
 * One row passed to the `search.filter` predicate. The predicate returns
 * `true` to include the page in the per-locale Orama index, `false` to
 * skip it.
 */
export type SearchablePage = {
  route: string;
  locale: string;
  title: string;
  frontmatter: Record<string, unknown>;
  /**
   * True when this row is a synthesised locale fallback (default-locale
   * content surfaced under another locale). Included for transparency,
   * but the predicate never actually receives fallback rows — bundoc
   * skips them before the predicate runs to prevent default-locale
   * content from duplicating into every other locale's index.
   */
  fallback: boolean;
};

/**
 * Default search predicate. Honours `frontmatter.search !== false` —
 * the conventional opt-out documented in `reference/frontmatter.mdx`.
 *
 * Exported so themes can extend rather than replace the convention:
 *
 *     filter: (p) => defaultSearchFilter(p) && !p.route.startsWith("/internal/")
 */
export const defaultSearchFilter = (page: SearchablePage): boolean =>
  page.frontmatter.search !== false;

export type BundocSearchConfig = {
  /**
   * Predicate applied to every (route, locale) pair before indexing.
   * Return `false` to exclude. Defaults to `defaultSearchFilter`.
   */
  filter?: (page: SearchablePage) => boolean;
  /**
   * Frontmatter keys whose string values (and arrays of strings) are
   * folded into each page's indexed body text. Defaults to
   * `['description']`. Pass an empty array to disable.
   */
  frontmatterFields?: readonly string[];
};

export type ResolvedSearchConfig = {
  /** Always defined — callers don't need to nullish-check. */
  filter: (page: SearchablePage) => boolean;
  /** Always defined — callers don't need to nullish-check. */
  frontmatterFields: readonly string[];
};

export type BundocConfig = {
  /** Available locales (BCP-47 codes; bundoc treats them as opaque strings). */
  locales: string[];
  /** Default locale (must be in `locales`). Routes for this locale are unprefixed. */
  defaultLocale: string;
  /** Path to the content directory. Default: `./content`. */
  contentDir?: string;
  /** Path to the theme entry file. Default: `./theme/index.tsx`. */
  themeEntry?: string;
  /** Path to the optional MDX components map. Default: `./theme/mdx-components.tsx`. */
  mdxComponentsEntry?: string;
  /** Base path the site is hosted under. Default: `/`. */
  basePath?: string;
  /** MDX pipeline tweaks (Shiki, etc.). */
  mdx?: BundocMdxConfig;
  /** Search indexing knobs. */
  search?: BundocSearchConfig;
  /**
   * Template for `document.title`. The literal `%s` is replaced by the
   * current page's title on every navigation. Example:
   * `"%s — bundoc"`. If omitted, bundoc leaves `document.title` set to
   * the bare page title.
   */
  titleTemplate?: string;
};

export type ResolvedMdxConfig = {
  /** Resolved highlighting setting. `false` disables; otherwise a theme map. */
  highlighting: false | { light: string; dark: string };
};

export type ResolvedConfig = Required<
  Omit<BundocConfig, "mdxComponentsEntry" | "mdx" | "search" | "titleTemplate">
> & {
  /** Absolute path to the project root (cwd at load time). */
  rootDir: string;
  /** Absolute path to content dir. */
  contentDir: string;
  /** Absolute path to the theme entry file. */
  themeEntry: string;
  /** Absolute path to the mdx-components file, if it exists. May be undefined. */
  mdxComponentsEntry: string | undefined;
  /** Resolved MDX pipeline config. */
  mdx: ResolvedMdxConfig;
  /** Resolved search config. `filter` is always callable. */
  search: ResolvedSearchConfig;
  /** Resolved title template (validated to contain `%s`), or undefined. */
  titleTemplate: string | undefined;
};

/** Identity helper for type-safe config authoring. */
export function defineConfig(config: BundocConfig): BundocConfig {
  return config;
}

const CONFIG_CANDIDATES = [
  "bundoc.config.ts",
  "bundoc.config.tsx",
  "bundoc.config.js",
  "bundoc.config.mjs",
];

/**
 * Locate and load the config file from `rootDir` (or cwd). Returns a
 * normalised `ResolvedConfig` with absolute paths.
 */
export async function loadConfig(
  rootDir: string = process.cwd(),
): Promise<ResolvedConfig> {
  const root = resolve(rootDir);
  let configPath: string | undefined;
  for (const name of CONFIG_CANDIDATES) {
    const candidate = resolve(root, name);
    if (await Bun.file(candidate).exists()) {
      configPath = candidate;
      break;
    }
  }
  if (!configPath) {
    throw new Error(
      `bundoc: no config file found in ${root}. Expected one of: ${CONFIG_CANDIDATES.join(", ")}`,
    );
  }

  const mod = await import(configPath);
  const raw: BundocConfig = mod.default ?? mod.config;
  if (!raw) {
    throw new Error(`bundoc: ${configPath} does not export a default config`);
  }
  return resolveConfig(raw, root);
}

export function resolveConfig(
  raw: BundocConfig,
  rootDir: string,
): ResolvedConfig {
  if (!raw.locales?.length) {
    throw new Error(
      "bundoc.config: `locales` must contain at least one locale",
    );
  }
  if (!raw.defaultLocale) {
    throw new Error("bundoc.config: `defaultLocale` is required");
  }
  if (!raw.locales.includes(raw.defaultLocale)) {
    throw new Error(
      `bundoc.config: defaultLocale "${raw.defaultLocale}" is not in locales [${raw.locales.join(", ")}]`,
    );
  }

  const contentDir = resolve(rootDir, raw.contentDir ?? "./content");
  const themeEntry = resolve(rootDir, raw.themeEntry ?? "./theme/index.tsx");
  const mdxComponentsEntryPath = resolve(
    rootDir,
    raw.mdxComponentsEntry ?? "./theme/mdx-components.tsx",
  );
  const basePath = normaliseBasePath(raw.basePath ?? "/");
  const titleTemplate = resolveTitleTemplate(raw.titleTemplate);

  return {
    locales: raw.locales,
    defaultLocale: raw.defaultLocale,
    contentDir,
    themeEntry,
    mdxComponentsEntry: mdxComponentsEntryPath,
    basePath,
    rootDir,
    mdx: resolveMdxConfig(raw.mdx),
    search: resolveSearchConfig(raw.search),
    titleTemplate,
  };
}

function resolveTitleTemplate(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (!raw.includes("%s")) {
    throw new Error(
      `bundoc.config: titleTemplate must contain "%s" (got ${JSON.stringify(raw)})`,
    );
  }
  return raw;
}

function resolveSearchConfig(
  raw: BundocSearchConfig | undefined,
): ResolvedSearchConfig {
  return {
    filter: raw?.filter ?? defaultSearchFilter,
    frontmatterFields: raw?.frontmatterFields ?? ["description"],
  };
}

function resolveMdxConfig(raw: BundocMdxConfig | undefined): ResolvedMdxConfig {
  const highlighting = raw?.highlighting;
  if (!highlighting) return { highlighting: false };
  if (highlighting === true) {
    return { highlighting: { light: "github-light", dark: "github-dark" } };
  }
  return {
    highlighting: {
      light: highlighting.light ?? "github-light",
      dark: highlighting.dark ?? "github-dark",
    },
  };
}

function normaliseBasePath(p: string): string {
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
