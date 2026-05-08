import { resolve } from "node:path";

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
};

export type ResolvedConfig = Required<Omit<BundocConfig, "mdxComponentsEntry">> & {
  /** Absolute path to the project root (cwd at load time). */
  rootDir: string;
  /** Absolute path to content dir. */
  contentDir: string;
  /** Absolute path to the theme entry file. */
  themeEntry: string;
  /** Absolute path to the mdx-components file, if it exists. May be undefined. */
  mdxComponentsEntry: string | undefined;
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
export async function loadConfig(rootDir: string = process.cwd()): Promise<ResolvedConfig> {
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

export function resolveConfig(raw: BundocConfig, rootDir: string): ResolvedConfig {
  if (!raw.locales?.length) {
    throw new Error("bundoc.config: `locales` must contain at least one locale");
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

  return {
    locales: raw.locales,
    defaultLocale: raw.defaultLocale,
    contentDir,
    themeEntry,
    mdxComponentsEntry: mdxComponentsEntryPath,
    basePath,
    rootDir,
  };
}

function normaliseBasePath(p: string): string {
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}
