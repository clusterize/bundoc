import { stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadConfig, type ResolvedConfig } from "../config/index.ts";

export async function startPreviewServer(opts: {
  out: string;
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
  const outDir = resolve(config.rootDir, opts.out);

  if (!(await dirExists(outDir))) {
    console.error(
      `[bundoc] no build output at ${outDir}. Run \`bundoc build\` first.`,
    );
    process.exit(1);
  }

  const indexFile = Bun.file(join(outDir, "index.html"));
  if (!(await indexFile.exists())) {
    console.error(`[bundoc] missing ${join(outDir, "index.html")}`);
    process.exit(1);
  }

  const basePath = config.basePath;

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    async fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;

      // Strip basePath before file lookup. `bundoc build` emits asset
      // URLs prefixed with basePath but writes files at the physical
      // root of `outDir`, mirroring what a reverse proxy serves in
      // production. Anything outside the basePath gets a 404.
      if (basePath !== "/") {
        if (pathname === basePath || pathname === basePath + "/") {
          pathname = "/";
        } else if (pathname.startsWith(basePath + "/")) {
          pathname = pathname.slice(basePath.length);
        } else {
          return new Response("Not found", { status: 404 });
        }
      }

      if (pathname === "/") pathname = "/index.html";

      // Try to serve a real file from outDir.
      const filePath = join(outDir, pathname);
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }

      // SPA fallback: any unknown path that doesn't look like an asset →
      // index.html (the client router will resolve it).
      if (looksLikeAsset(pathname)) {
        return new Response("Not found", { status: 404 });
      }
      return new Response(indexFile);
    },
  });

  console.log(`bundoc preview → http://${opts.host}:${server.port}`);
  process.on("SIGINT", () => {
    server.stop();
    process.exit(0);
  });
  return { server, outDir };
}

function looksLikeAsset(pathname: string): boolean {
  // Heuristic: asset paths have an extension and aren't directory-like.
  const last = pathname.split("/").pop() ?? "";
  return last.includes(".");
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}
