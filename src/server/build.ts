import { join, resolve, sep, basename } from "node:path";
import { mkdir, rm, cp, stat } from "node:fs/promises";
import { loadConfig } from "../config/index.ts";
import { regenerateAll } from "./cache.ts";

export async function runBuild(opts: { out: string }) {
  const config = await loadConfig();
  const paths = await regenerateAll({ config, development: false });
  const outDir = resolve(config.rootDir, opts.out);

  // Wipe and recreate dist.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

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
  });

  if (!result.success) {
    console.error(`[bundoc] build failed:`);
    for (const log of result.logs) console.error(log);
    process.exit(1);
  }

  // Copy theme/public/* if it exists.
  const publicDir = resolve(config.rootDir, "theme", "public");
  if (await dirExists(publicDir)) {
    await cp(publicDir, outDir, { recursive: true });
  }

  console.log(`bundoc build → ${opts.out}/ (${result.outputs.length} files)`);
  return { outDir, paths };
}

function joinPublicPath(basePath: string): string {
  if (basePath === "/" || basePath === "") return "/";
  return basePath.endsWith("/") ? basePath : basePath + "/";
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
