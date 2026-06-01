import { afterAll, beforeAll, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveConfig } from "../config/index.ts";
import { startDevServer } from "../server/dev-server.ts";

/**
 * basePath-aware dev server tests:
 *  - search-index JSON is reachable under the configured basePath, and
 *  - MDX absolute URLs are basePath-prefixed in compiled shims, and
 *  - the HMR WebSocket monkey-patch is injected into the dev shell
 *    (BASEPATH_MONKEY_PATCH_PLAN.md).
 *
 * The fixture lives *inside* the bundoc package (not /tmp) so that bundling
 * the SPA shell at `/` can resolve the `@clusterize/bundoc/*` workspace
 * package via the normal node_modules walk — a /tmp fixture has no such
 * chain and the shell build would fail.
 */

const fixtureDir = resolve(import.meta.dir, "../../.bundoc-basepath-fixture");
const port = 6452;
let server: Awaited<ReturnType<typeof startDevServer>> | undefined;

beforeAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true });
  // Minimal content + theme stub. The stub theme keeps the SPA-shell bundle
  // cheap while still exercising the real bundler path.
  await Bun.write(
    join(fixtureDir, "content/index.mdx"),
    `---\ntitle: Home\n---\n\n# Home\n\nWelcome to the documentation site.\n\n## Getting started\n\nInstall the package and run it.\n`,
  );
  await Bun.write(
    join(fixtureDir, "content/with-image.mdx"),
    `# Image page\n\n![alt](/x.png)\n\n[guide](/guides/install)\n`,
  );
  await Bun.write(
    join(fixtureDir, "theme/index.tsx"),
    `export default function ThemeApp() { return null; }\n`,
  );
  const config = resolveConfig(
    {
      locales: ["en"],
      defaultLocale: "en",
      basePath: "/docs",
    },
    fixtureDir,
  );
  server = await startDevServer({ port, host: "localhost", config });
}, 30_000);

afterAll(async () => {
  server?.server.stop();
  await rm(fixtureDir, { recursive: true, force: true });
});

async function fetchText(path: string): Promise<string> {
  const r = await fetch(`http://localhost:${port}${path}`);
  return await r.text();
}

test("search index is served under basePath", async () => {
  const r = await fetch(`http://localhost:${port}/docs/_bundoc/search/en.json`);
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toContain("application/json");
  const body = await r.json();
  // The persisted Orama dump is an object with internal keys — assert
  // it's a non-empty object rather than the SPA HTML shell.
  expect(typeof body).toBe("object");
});

test("search index is NOT served at the unprefixed path", async () => {
  const r = await fetch(`http://localhost:${port}/_bundoc/search/en.json`);
  // The unprefixed path falls through to `/*` → SPA shell (HTML),
  // not the JSON index.
  const contentType = r.headers.get("content-type") ?? "";
  expect(contentType).not.toContain("application/json");
});

test("MDX absolute URLs are basePath-prefixed in compiled shims", async () => {
  const { Glob } = Bun;
  const glob = new Glob("with-image.*.tsx");
  let shimPath: string | undefined;
  for await (const f of glob.scan({
    cwd: join(fixtureDir, ".bundoc/cache/pages"),
    absolute: true,
  })) {
    shimPath = f;
    break;
  }
  expect(shimPath).toBeDefined();
  const shim = await Bun.file(shimPath!).text();
  expect(shim).toContain('"/docs/x.png"');
  expect(shim).toContain('"/docs/guides/install"');
  expect(shim).not.toContain('"/x.png"');
});

test("search index round-trip with basePath: fetch → restore → query", async () => {
  const { create, load, search } = await import("@orama/orama");
  const r = await fetch(`http://localhost:${port}/docs/_bundoc/search/en.json`);
  expect(r.status).toBe(200);
  const data = await r.json();
  const db = create({ schema: { __placeholder: "string" } });
  load(db, data);
  const hits = await search(db, { term: "install", tolerance: 1 });
  expect(hits.count).toBeGreaterThan(0);
  // The hit should reference the "/" route (our index.mdx)
  const routes = new Set(
    hits.hits.map((h) => (h.document as unknown as { route: string }).route),
  );
  expect(routes.has("/")).toBe(true);
});

// --- HMR WebSocket monkey-patch (BASEPATH_MONKEY_PATCH_PLAN.md) ---

test("injects the WebSocket monkey-patch into the served shell", async () => {
  const body = await fetchText("/");
  expect(body).toContain("window.WebSocket");
  expect(body).toContain("__bundoc_app");
  // app id derived from basePath "/docs"
  expect(body).toContain('"docs"');
});

test("patch script runs before the bundler-injected HMR client script", async () => {
  const body = await fetchText("/");
  const patchIdx = body.indexOf("window.WebSocket");
  const clientIdx = body.search(/<script[^>]+src="\/_bun\/client\//);
  expect(patchIdx).toBeGreaterThanOrEqual(0);
  expect(clientIdx).toBeGreaterThanOrEqual(0);
  expect(patchIdx).toBeLessThan(clientIdx);
});

test("internal HMR client JS still calls `new WebSocket(` (call-site tripwire)", async () => {
  // Hard assertion: if a future Bun version captures `WebSocket` at
  // module-init instead of looking it up on `window` at call time, the
  // monkey-patch silently stops intercepting. Pinning the literal here turns
  // that into a red CI run instead of broken HMR with no error.
  const body = await fetchText("/");
  const m = body.match(/<script[^>]+src="(\/_bun\/client\/[^"]+)"/);
  const clientSrc = m?.[1];
  expect(clientSrc).toBeDefined();
  const clientJs = await fetchText(clientSrc!);
  expect(clientJs).toContain("new WebSocket(");
});

test("Bun's HMR socket accepts the injected query param (no proxy needed)", async () => {
  // Connecting directly to the dev server with the extra query param must
  // reach OPEN — this pins the guarantee that setting `basePath` never forces
  // a proxy for local dev: Bun tolerates the unknown query param on the WS
  // upgrade and HMR works as-is.
  const ws = new WebSocket(
    `ws://localhost:${port}/_bun/hmr?__bundoc_app=docs`,
    "bun-hmr",
  );
  const opened = await new Promise<boolean>((res) => {
    const t = setTimeout(() => res(false), 5000);
    ws.addEventListener("open", () => {
      clearTimeout(t);
      res(true);
    });
    ws.addEventListener("error", () => {
      clearTimeout(t);
      res(false);
    });
  });
  expect(opened).toBe(true);
  ws.close();
});
