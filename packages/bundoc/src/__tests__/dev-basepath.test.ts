import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../config/index.ts";
import { startDevServer } from "../server/dev-server.ts";

/**
 * basePath-aware dev server. Mirrors the client-side URL builder in
 * `theme/search.ts` so search-index JSON is reachable under the configured
 * basePath (not at the unprefixed path).
 */

const port = 6452;
let server: Awaited<ReturnType<typeof startDevServer>> | undefined;
let fixtureDir: string | undefined;

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), "bundoc-basepath-"));
  // Minimal content + theme stub. The theme is never bundled in this
  // test (we only fetch JSON routes, never the SPA shell).
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
});

afterAll(async () => {
  server?.server.stop();
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true });
});

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
    cwd: join(fixtureDir!, ".bundoc/cache/pages"),
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
