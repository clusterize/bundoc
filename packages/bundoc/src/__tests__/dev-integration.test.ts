import { test, expect, beforeAll, afterAll } from "bun:test";
import { startDevServer } from "../server/dev-server.ts";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";

const docsDir = resolve(import.meta.dir, "../../../docs");
const port = 6451;

let server: Awaited<ReturnType<typeof startDevServer>> | undefined;

beforeAll(async () => {
  // Run inside docs/.
  process.chdir(docsDir);
  await rm(resolve(docsDir, ".bundoc"), { recursive: true, force: true });
  server = await startDevServer({ port, host: "localhost" });
});

afterAll(async () => {
  server?.server.stop();
});

async function fetchText(path: string): Promise<{ status: number; body: string }> {
  const r = await fetch(`http://localhost:${port}${path}`);
  return { status: r.status, body: await r.text() };
}

test("serves SPA shell at /", async () => {
  const r = await fetchText("/");
  expect(r.status).toBe(200);
  expect(r.body).toContain('<div id="root">');
  expect(r.body).toMatch(/<script[^>]*>/);
});

test("serves SPA shell at /de", async () => {
  const r = await fetchText("/de");
  expect(r.status).toBe(200);
  expect(r.body).toContain('<div id="root">');
});

test("serves SPA shell at /getting-started/installation", async () => {
  const r = await fetchText("/getting-started/installation");
  expect(r.status).toBe(200);
});

test("serves SPA shell at /de/getting-started/installation (fallback)", async () => {
  const r = await fetchText("/de/getting-started/installation");
  expect(r.status).toBe(200);
});

test("manifest cache contains importer thunks for every (route × locale)", async () => {
  const manifest = await Bun.file(
    resolve(docsDir, ".bundoc/cache/manifest.ts"),
  ).text();
  expect(manifest).toContain('"/": {');
  expect(manifest).toContain('"/getting-started/installation": {');
  // Importer keys are present.
  expect(manifest).toMatch(/__page_\d+: \(\) => import\(/);
});

test("compiled .tsx shims exist for each MDX source file", async () => {
  const { Glob } = Bun;
  const glob = new Glob("*.tsx");
  const found: string[] = [];
  for await (const f of glob.scan({ cwd: resolve(docsDir, ".bundoc/cache/pages") })) {
    found.push(f);
  }
  const sourceGlob = new Glob("**/*.mdx");
  const sources: string[] = [];
  for await (const f of sourceGlob.scan({ cwd: resolve(docsDir, "content") })) {
    sources.push(f);
  }
  // One shim per unique MDX source file.
  expect(found.length).toBe(sources.length);
});

test("search index files are served per locale", async () => {
  for (const locale of ["en", "de"]) {
    const r = await fetch(`http://localhost:${port}/_bundoc/search/${locale}.bin`);
    expect(r.status).toBe(200);
    const buf = new Uint8Array(await r.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(1024); // non-trivial index
  }
});

test("search index round-trip: fetch → restore → query", async () => {
  const { restore } = await import("@orama/plugin-data-persistence");
  const { search } = await import("@orama/orama");
  const r = await fetch(`http://localhost:${port}/_bundoc/search/en.bin`);
  const blob = await r.text();
  const db = await restore("binary", blob);
  const hits = await search(db, { term: "installation", tolerance: 1 });
  expect(hits.count).toBeGreaterThan(0);
  const routes = new Set(hits.hits.map((h) => (h.document as unknown as { route: string }).route));
  expect(routes.has("/getting-started/installation")).toBe(true);
});
