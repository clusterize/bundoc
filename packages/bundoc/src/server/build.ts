import { cp, mkdir, rm, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig } from "../config/index.ts";
import { cachePaths, regenerateAll } from "./cache.ts";
import { loadBunfigPlugins } from "./load-bunfig-plugins.ts";

export async function runBuild(opts: { out: string }) {
  const config = await loadConfig();
  const paths = await regenerateAll({ config, development: false });
  const outDir = resolve(config.rootDir, opts.out);

  // Wipe and recreate dist.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const bunfigPlugins = await loadBunfigPlugins(config.rootDir);
  if (bunfigPlugins.length) {
    console.log(
      `[bundoc] using bunfig plugins: ${bunfigPlugins.map((p) => p.name).join(", ")}`,
    );
  }

  const result = await Bun.build({
    entrypoints: [paths.htmlPath],
    outdir: outDir,
    target: "browser",
    splitting: true,
    minify: true,
    sourcemap: "external",
    naming: {
      entry: "index.html",
      chunk: "[name]-[hash].[ext]",
      asset: "[name]-[hash].[ext]",
    },
    publicPath: joinPublicPath(config.basePath),
    plugins: bunfigPlugins,
  });

  if (!result.success) {
    console.error(`[bundoc] build failed:`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  // Copy <rootDir>/public/** verbatim to outDir (Next/Astro/SvelteKit
  // convention — see `bundoc dev` which serves the same directory).
  const publicDir = resolve(config.rootDir, "public");
  if (await dirExists(publicDir)) {
    await cp(publicDir, outDir, { recursive: true });
  }

  // Copy persisted search indexes (one JSON file per locale) to dist/_bundoc/search/.
  const searchSrc = cachePaths(config).searchDir;
  if (await dirExists(searchSrc)) {
    const searchDst = join(outDir, "_bundoc", "search");
    await mkdir(searchDst, { recursive: true });
    await cp(searchSrc, searchDst, { recursive: true });
  }

  console.log(`bundoc build → ${opts.out}/ (${result.outputs.length} files)`);
  return { outDir, paths };
}

function joinPublicPath(basePath: string): string {
  if (basePath === "/" || basePath === "") return "/";
  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
