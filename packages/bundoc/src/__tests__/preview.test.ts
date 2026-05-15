import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../config/index.ts";
import { startPreviewServer } from "../server/preview.ts";

/**
 * `bundoc preview` serves the static build verbatim with SPA fallback.
 * These tests fake a `dist/` shape and verify that:
 * - assets resolve by physical path (not via basePath prefix in the
 *   filesystem), and
 * - SPA fallback returns the index.html shell for unknown extension-less
 *   paths.
 *
 * Under `basePath`, the preview server must strip the prefix before
 * file lookup — `bundoc build` emits asset URLs prefixed with basePath
 * but writes files at the physical root of `outDir`.
 */

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "bundoc-preview-"));
  const dist = join(root, "dist");
  await Bun.write(
    join(dist, "index.html"),
    `<!doctype html><html><body><div id="root"></div><script src="/dist-marker"></script></body></html>`,
  );
  await Bun.write(join(dist, "asset.js"), "console.log('ok');");
  await Bun.write(join(dist, "_bundoc/search/en.json"), '{"ok":true}');
  return root;
}

describe("preview without basePath", () => {
  const port = 6453;
  let server: Awaited<ReturnType<typeof startPreviewServer>> | undefined;
  let rootDir: string | undefined;

  beforeAll(async () => {
    rootDir = await makeFixture();
    const config = resolveConfig(
      { locales: ["en"], defaultLocale: "en", basePath: "/" },
      rootDir,
    );
    server = await startPreviewServer({
      out: "dist",
      port,
      host: "localhost",
      config,
    });
  });

  afterAll(async () => {
    server?.server.stop();
    if (rootDir) await rm(rootDir, { recursive: true, force: true });
  });

  test("serves index.html at /", async () => {
    const r = await fetch(`http://localhost:${port}/`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root">');
  });

  test("serves a real asset by physical path", async () => {
    const r = await fetch(`http://localhost:${port}/asset.js`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("console.log");
  });

  test("serves search index JSON", async () => {
    const r = await fetch(`http://localhost:${port}/_bundoc/search/en.json`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  test("SPA fallback for unknown extension-less paths", async () => {
    const r = await fetch(`http://localhost:${port}/some/spa/route`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root">');
  });

  test("404 for unknown asset paths", async () => {
    const r = await fetch(`http://localhost:${port}/missing.js`);
    expect(r.status).toBe(404);
  });
});

describe("preview with basePath", () => {
  const port = 6454;
  let server: Awaited<ReturnType<typeof startPreviewServer>> | undefined;
  let rootDir: string | undefined;

  beforeAll(async () => {
    rootDir = await makeFixture();
    const config = resolveConfig(
      { locales: ["en"], defaultLocale: "en", basePath: "/docs" },
      rootDir,
    );
    server = await startPreviewServer({
      out: "dist",
      port,
      host: "localhost",
      config,
    });
  });

  afterAll(async () => {
    server?.server.stop();
    if (rootDir) await rm(rootDir, { recursive: true, force: true });
  });

  test("serves index.html at <basePath>/", async () => {
    const r = await fetch(`http://localhost:${port}/docs/`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root">');
  });

  test("serves index.html at <basePath> (no trailing slash)", async () => {
    const r = await fetch(`http://localhost:${port}/docs`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root">');
  });

  test("serves asset under basePath prefix", async () => {
    const r = await fetch(`http://localhost:${port}/docs/asset.js`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("console.log");
  });

  test("serves search index JSON under basePath", async () => {
    const r = await fetch(
      `http://localhost:${port}/docs/_bundoc/search/en.json`,
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  test("SPA fallback under basePath for unknown extension-less paths", async () => {
    const r = await fetch(`http://localhost:${port}/docs/some/spa/route`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain('<div id="root">');
  });

  test("404 for paths outside basePath", async () => {
    const r = await fetch(`http://localhost:${port}/asset.js`);
    expect(r.status).toBe(404);
  });

  test("404 for SPA-looking path outside basePath", async () => {
    const r = await fetch(`http://localhost:${port}/some/spa/route`);
    expect(r.status).toBe(404);
  });
});
