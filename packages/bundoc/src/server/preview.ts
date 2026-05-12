import { resolve, join } from "node:path";
import { stat } from "node:fs/promises";
import { loadConfig } from "../config/index.ts";

export async function startPreviewServer(opts: { out: string; port: number; host: string }) {
  const config = await loadConfig();
  const outDir = resolve(config.rootDir, opts.out);

  if (!(await dirExists(outDir))) {
    console.error(`[bundoc] no build output at ${outDir}. Run \`bundoc build\` first.`);
    process.exit(1);
  }

  const indexFile = Bun.file(join(outDir, "index.html"));
  if (!(await indexFile.exists())) {
    console.error(`[bundoc] missing ${join(outDir, "index.html")}`);
    process.exit(1);
  }

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    async fetch(req) {
      const url = new URL(req.url);
      let pathname = url.pathname;
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
