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

/**
 * One row passed to the `pdf.filter` predicate. Same shape as
 * `SearchablePage`, but unlike search, fallback rows DO reach the
 * predicate: a handbook for a non-default locale includes default-locale
 * content for untranslated pages.
 */
export type PdfablePage = SearchablePage;

/**
 * Default PDF predicate. Honours `frontmatter.pdf !== false` — the
 * conventional opt-out documented in `reference/frontmatter.mdx`.
 */
export const defaultPdfFilter = (page: PdfablePage): boolean =>
  page.frontmatter.pdf !== false;

/** Paper formats bundoc knows the dimensions of. */
export type PdfPaperFormat = "A3" | "A4" | "A5" | "Letter" | "Legal";

/** CSS length, e.g. `"20mm"`, `"0.75in"`, `"48px"`. */
export type CssLength = string;

export type BundocPdfConfig = {
  /**
   * Handbook title, passed to the cover, TOC, header and footer and
   * written into the PDF metadata. Either one string for every locale
   * or a per-locale map. Default: `"Documentation"`.
   */
  title?: string | Record<string, string>;
  /** Output filename stem; files are `<fileName>.<locale>.pdf`. Default: `handbook`. */
  fileName?: string;
  /** Path to the PDF theme module (exports `PdfCover`, `PdfHeader`, …). Default: `./theme/pdf.tsx`. */
  themeEntry?: string;
  /** Paper format or explicit page size. Default: `A4`. */
  format?: PdfPaperFormat | { width: CssLength; height: CssLength };
  /** Rotate the paper format. Default: `false`. */
  landscape?: boolean;
  /**
   * Page margins. The top and bottom margins are where `PdfHeader` and
   * `PdfFooter` render. Default: `{ top: "22mm", right: "18mm", bottom: "20mm", left: "18mm" }`.
   */
  margin?: {
    top?: CssLength;
    right?: CssLength;
    bottom?: CssLength;
    left?: CssLength;
  };
  /** Render a cover page. Default: `true`. */
  cover?: boolean;
  /** Render a table of contents after the cover. Default: `true`. */
  toc?: boolean;
  /**
   * Predicate applied to every (route, locale) pair. Return `false` to
   * leave the page out of the handbook. Defaults to `defaultPdfFilter`.
   */
  filter?: (page: PdfablePage) => boolean;
};

export type ResolvedPdfConfig = {
  title: Record<string, string>;
  fileName: string;
  /** Absolute path; the file may not exist (bundoc then uses built-in defaults). */
  themeEntry: string;
  /** Page size as CSS lengths, landscape already applied. */
  paper: { width: CssLength; height: CssLength };
  margin: {
    top: CssLength;
    right: CssLength;
    bottom: CssLength;
    left: CssLength;
  };
  cover: boolean;
  toc: boolean;
  filter: (page: PdfablePage) => boolean;
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
  /** `bundoc pdf` handbook settings. */
  pdf?: BundocPdfConfig;
};

export type ResolvedMdxConfig = {
  /** Resolved highlighting setting. `false` disables; otherwise a theme map. */
  highlighting: false | { light: string; dark: string };
};

export type ResolvedConfig = Required<
  Omit<
    BundocConfig,
    "mdxComponentsEntry" | "mdx" | "search" | "titleTemplate" | "pdf"
  >
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
  /** Resolved `bundoc pdf` config. */
  pdf: ResolvedPdfConfig;
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
    pdf: resolvePdfConfig(raw.pdf, rootDir, raw.locales),
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

const PAPER_SIZES: Record<PdfPaperFormat, { width: string; height: string }> = {
  A3: { width: "297mm", height: "420mm" },
  A4: { width: "210mm", height: "297mm" },
  A5: { width: "148mm", height: "210mm" },
  Letter: { width: "8.5in", height: "11in" },
  Legal: { width: "8.5in", height: "14in" },
};

function resolvePdfConfig(
  raw: BundocPdfConfig | undefined,
  rootDir: string,
  locales: string[],
): ResolvedPdfConfig {
  const format = raw?.format ?? "A4";
  const size = typeof format === "string" ? PAPER_SIZES[format] : format;
  if (!size) {
    throw new Error(
      `bundoc.config: unknown pdf.format ${JSON.stringify(format)} (expected one of ${Object.keys(PAPER_SIZES).join(", ")} or { width, height })`,
    );
  }
  const paper = raw?.landscape
    ? { width: size.height, height: size.width }
    : { ...size };
  const rawTitle = raw?.title ?? "Documentation";
  const title = Object.fromEntries(
    locales.map((l) => [
      l,
      typeof rawTitle === "string"
        ? rawTitle
        : (rawTitle[l] ?? Object.values(rawTitle)[0] ?? "Documentation"),
    ]),
  );
  return {
    title,
    fileName: raw?.fileName ?? "handbook",
    themeEntry: resolve(rootDir, raw?.themeEntry ?? "./theme/pdf.tsx"),
    paper,
    margin: {
      top: raw?.margin?.top ?? "22mm",
      right: raw?.margin?.right ?? "18mm",
      bottom: raw?.margin?.bottom ?? "20mm",
      left: raw?.margin?.left ?? "18mm",
    },
    cover: raw?.cover ?? true,
    toc: raw?.toc ?? true,
    filter: raw?.filter ?? defaultPdfFilter,
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
