import { watch } from "node:fs";
import { join } from "node:path";
import { loadConfig, type ResolvedConfig } from "../config/index.ts";
import {
  regenerateAll,
  rebuildContentCache,
  recompileSingle,
} from "./cache.ts";

export async function startDevServer(opts: { port: number; host: string }) {
  const config = await loadConfig();
  const paths = await regenerateAll({ config, development: true });

  // Bun.serve's HTML import requires a static path; we already wrote the
  // shell to the cache. Dynamic-import it at runtime so the bundler picks
  // it up. (Bun's HMR handles edits to the cache files.)
  const indexHtml = await import(paths.htmlPath);

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    development: {
      hmr: true,
      console: true,
    },
    routes: {
      "/*": indexHtml.default,
    },
  });

  setupWatchers(config);

  process.on("SIGINT", () => {
    server.stop();
    process.exit(0);
  });

  console.log(`bundoc dev → http://${opts.host}:${server.port}`);
  return { server, paths, config };
}

function setupWatchers(config: ResolvedConfig) {
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

  const watcher = watch(config.contentDir, { recursive: true }, async (event, filename) => {
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
  });

  process.on("SIGINT", () => watcher.close());
}
