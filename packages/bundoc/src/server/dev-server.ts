import { watch } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { join, sep } from "node:path";
import { Glob } from "bun";
import { loadConfig, type ResolvedConfig } from "../config/index.ts";
import {
  cachePaths,
  rebuildContentCache,
  recompileSingle,
  regenerateAll,
} from "./cache.ts";

export async function startDevServer(opts: {
  port: number;
  host: string;
  /**
   * Optional pre-resolved config. When omitted, `loadConfig()` reads
   * `bundoc.config.ts` from `process.cwd()`. Tests use this to drive a
   * server from a fixture directory without chdir-ing.
   */
  config?: ResolvedConfig;
}) {
  const config = opts.config ?? (await loadConfig());
  const paths = await regenerateAll({ config, development: true });

  // Bun.serve's HTML import requires a static path; we already wrote the
  // shell to the cache. Dynamic-import it at runtime so the bundler picks
  // it up. (Bun's HMR handles edits to the cache files.)
  const indexHtml = await import(paths.htmlPath);

  const searchDir = cachePaths(config).searchDir;
  const publicDir = join(config.rootDir, "public");
  await ensureDir(publicDir);

  // Search route mirrors the client URL builder (`theme/search.ts`),
  // which prefixes `basePath` when not `/`. Without this prefix the
  // client would request `<basePath>/_bundoc/search/<locale>.json` and
  // fall through to the SPA shell.
  const searchRoute =
    config.basePath === "/"
      ? "/_bundoc/search/:filename"
      : `${config.basePath}/_bundoc/search/:filename`;

  const baseRoutes: Record<
    string,
    (req: Bun.BunRequest<"/_bundoc/search/:filename">) => Response
  > = {
    [searchRoute]: (req) => {
      const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
      const file = Bun.file(join(searchDir, safe));
      const contentType = safe.endsWith(".json")
        ? "application/json"
        : "application/octet-stream";
      return new Response(file, {
        headers: { "content-type": contentType },
      });
    },
  };

  const buildRoutes = async () => ({
    ...(await buildPublicRoutes(publicDir, config.basePath)),
    ...baseRoutes,
    "/*": indexHtml.default,
  });

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    development: {
      hmr: true,
      console: true,
    },
    routes: await buildRoutes(),
  });

  setupWatchers({ config, publicDir, server, buildRoutes });

  process.on("SIGINT", () => {
    server.stop();
    process.exit(0);
  });

  console.log(`bundoc dev → http://${opts.host}:${server.port}`);
  return { server, paths, config };
}

async function ensureDir(p: string): Promise<void> {
  try {
    const s = await stat(p);
    if (s.isDirectory()) return;
  } catch {
    // not present → create below
  }
  await mkdir(p, { recursive: true });
}

/**
 * Scan `publicDir` and return a route map (`<basePath>/<file>` → BunFile).
 * Each value is a `BunFile`, so Bun reads contents from disk per request —
 * existing-file content updates are picked up without a reload. New or
 * removed files require a reload (see `setupWatchers`).
 */
async function buildPublicRoutes(
  publicDir: string,
  basePath: string,
): Promise<Record<string, Bun.BunFile>> {
  const routes: Record<string, Bun.BunFile> = {};
  const glob = new Glob("**/*");
  for await (const file of glob.scan({
    cwd: publicDir,
    onlyFiles: true,
    dot: false,
  })) {
    const slashed = "/" + file.split(sep).join("/");
    const url = basePath === "/" ? slashed : `${basePath}${slashed}`;
    routes[url] = Bun.file(join(publicDir, file));
  }
  return routes;
}

function setupWatchers(opts: {
  config: ResolvedConfig;
  publicDir: string;
  server: Bun.Server<unknown>;
  buildRoutes: () => Promise<Record<string, unknown>>;
}) {
  const { config, publicDir, server, buildRoutes } = opts;

  let pending: NodeJS.Timeout | undefined;
  const debouncedRebuild = (reason: string) => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(async () => {
      try {
        await rebuildContentCache({ config, development: true });
        console.log(`[bundoc] manifest updated (${reason})`);
      } catch (err) {
        console.error(`[bundoc] failed to rebuild content cache:`, err);
      }
    }, 50);
  };

  const watcher = watch(
    config.contentDir,
    { recursive: true },
    async (event, filename) => {
      if (!filename) return;
      const isMdx = filename.endsWith(".mdx");
      const isMeta = filename.endsWith("_meta.json");
      if (!isMdx && !isMeta) return;

      // For 'change' on an existing .mdx, just recompile that single file
      // (no manifest changes). For 'rename' (add/remove) or _meta.json,
      // rebuild the whole manifest.
      if (event === "change" && isMdx) {
        try {
          await recompileSingle({
            config,
            sourcePath: join(config.contentDir, filename),
            development: true,
          });
          console.log(`[bundoc] recompiled ${filename}`);
        } catch (err) {
          console.error(`[bundoc] failed to recompile ${filename}:`, err);
        }
      } else {
        debouncedRebuild(`${event}: ${filename}`);
      }
    },
  );

  // Watch public/ for add/remove. Existing-file content updates are picked
  // up per request via BunFile; only the route table needs reloading when
  // the *set* of files changes.
  let publicPending: NodeJS.Timeout | undefined;
  const publicWatcher = watch(
    publicDir,
    { recursive: true },
    (event, filename) => {
      if (!filename) return;
      if (event !== "rename") return; // 'change' is content-only
      if (publicPending) clearTimeout(publicPending);
      publicPending = setTimeout(async () => {
        try {
          server.reload({ routes: await buildRoutes() } as never);
          console.log(`[bundoc] public/ routes reloaded (${filename})`);
        } catch (err) {
          console.error(`[bundoc] failed to reload public routes:`, err);
        }
      }, 50);
    },
  );

  process.on("SIGINT", () => {
    watcher.close();
    publicWatcher.close();
  });
}
