import { afterAll, beforeAll, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { startDevServer } from "../server/dev-server.ts";

const docsDir = resolve(import.meta.dir, "../../../docs");
const port = 6451;
const publicAsset = join(docsDir, "public/__test_asset.txt");

let server: Awaited<ReturnType<typeof startDevServer>> | undefined;

beforeAll(async () => {
  // Run inside docs/.
  process.chdir(docsDir);
  await rm(resolve(docsDir, ".bundoc"), { recursive: true, force: true });
  // Write the public asset before starting so the pre-scan picks it up
  // deterministically (the watcher would also catch it, but debounce
  // makes the timing race-y in tests).
  await Bun.write(publicAsset, "hello");
  server = await startDevServer({ port, host: "localhost" });
}, 30_000);

afterAll(async () => {
  server?.server.stop();
  await rm(publicAsset, { force: true });
});

async function fetchText(
  path: string,
): Promise<{ status: number; body: string }> {
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
  for await (const f of glob.scan({
    cwd: resolve(docsDir, ".bundoc/cache/pages"),
  })) {
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
    const r = await fetch(
      `http://localhost:${port}/_bundoc/search/${locale}.json`,
    );
    expect(r.status).toBe(200);
    const buf = new Uint8Array(await r.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(1024); // non-trivial index
  }
});

test("serves public/* assets", async () => {
  const r = await fetch(`http://localhost:${port}/__test_asset.txt`);
  expect(r.status).toBe(200);
  expect(await r.text()).toBe("hello");
});

test("unknown extension-less path returns SPA shell", async () => {
  const r = await fetchText("/some-unknown-route");
  expect(r.status).toBe(200);
  expect(r.body).toContain('<div id="root">');
});

test("path traversal does not escape publicDir", async () => {
  const r = await fetch(
    `http://localhost:${port}/__test_asset.txt/../../etc/passwd`,
  );
  const body = await r.text();
  expect(body).not.toMatch(/root:/);
});

test("search index round-trip: fetch → restore → query", async () => {
  const { create, load, search } = await import("@orama/orama");
  const r = await fetch(`http://localhost:${port}/_bundoc/search/en.json`);
  const data = await r.json();
  const db = create({ schema: { __placeholder: "string" } });
  load(db, data);
  const hits = await search(db, { term: "installation", tolerance: 1 });
  expect(hits.count).toBeGreaterThan(0);
  const routes = new Set(
    hits.hits.map((h) => (h.document as unknown as { route: string }).route),
  );
  expect(routes.has("/getting-started/installation")).toBe(true);
});
