import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { discoverContent } from "./discover.ts";
import { buildManifest, emitManifestModule, type NavNode } from "./manifest.ts";

const contentDir = resolve(import.meta.dir, "../../../docs/content");

async function buildFromFixture(files: {
  mdx: Record<string, string>;
  meta: Record<string, unknown>;
}): Promise<NavNode> {
  const dir = await mkdtemp(join(tmpdir(), "bundoc-meta-"));
  try {
    for (const [path, body] of Object.entries(files.mdx)) {
      await Bun.write(join(dir, path), body);
    }
    await Bun.write(
      join(dir, "_meta.json"),
      JSON.stringify(files.meta, null, 2),
    );
    const discovery = await discoverContent({
      contentDir: dir,
      locales: ["en"],
      defaultLocale: "en",
    });
    const manifest = await buildManifest({
      discovery,
      contentDir: dir,
      locales: ["en"],
      defaultLocale: "en",
      basePath: "/",
    });
    return manifest.nav.en!;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("buildManifest: all locales resolvable, fallback flagged when needed", async () => {
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });

  // Root has both locales; no fallback flag.
  expect(manifest.routes["/"]!.en).toBeDefined();
  expect(manifest.routes["/"]!.de).toBeDefined();
  expect(manifest.routes["/"]!.en!.fallback).toBeUndefined();
  expect(manifest.routes["/"]!.de!.fallback).toBeUndefined();
  // English-only routes fall back to English when the German locale asks.
  const installation = manifest.routes["/getting-started/installation"];
  expect(installation).toBeDefined();
  expect(installation!.en!.fallback).toBeUndefined();
  expect(installation!.de!.fallback).toBe(true);
  expect(manifest.order.en!.length).toBeGreaterThan(0);
  expect(manifest.order.de!.length).toBeGreaterThan(0);
});

test("nav tree groups all routes under a single category even when _meta.json overrides the label", async () => {
  // Regression: a `_meta.json` setting `"api": "API"` used to make the
  // category-lookup miss its match (it compared `humanise("api")` = "Api"
  // to the existing node's overridden label "API"), so every leaf got its
  // own duplicate "API" category in the sidebar.
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });
  const apiCategories = manifest.nav.en!.children.filter(
    (c) => c.seg === "api" || c.label === "API",
  );
  expect(apiCategories.length).toBe(1);
  // And it should have all four expected leaves (config, hooks, components, cli, manifest).
  expect(apiCategories[0]!.children.length).toBeGreaterThanOrEqual(4);
});

test("NavNode.meta carries unknown _meta.json keys, strips known ones", async () => {
  const tree = await buildFromFixture({
    mdx: {
      "core/installation.mdx": "# Installation\n",
    },
    meta: {
      core: { label: "Core", order: 0, icon: "cpu", badge: "new" },
    },
  });
  const core = tree.children.find((c) => c.seg === "core")!;
  expect(core).toBeDefined();
  expect(core.label).toBe("Core");
  expect(core.order).toBe(0);
  expect(core.meta).toEqual({ icon: "cpu", badge: "new" });
});

test("NavNode.meta is undefined when only known keys are present", async () => {
  const tree = await buildFromFixture({
    mdx: {
      "core/installation.mdx": "# Installation\n",
    },
    meta: {
      core: { label: "Core", order: 0 },
    },
  });
  const core = tree.children.find((c) => c.seg === "core")!;
  expect(core).toBeDefined();
  expect(core.label).toBe("Core");
  expect(core.meta).toBeUndefined();
});

test("string-shorthand _meta.json entries produce no NavNode.meta", async () => {
  const tree = await buildFromFixture({
    mdx: {
      "core/installation.mdx": "# Installation\n",
    },
    meta: {
      core: "Core",
    },
  });
  const core = tree.children.find((c) => c.seg === "core")!;
  expect(core).toBeDefined();
  expect(core.label).toBe("Core");
  expect(core.meta).toBeUndefined();
});

test("emitManifestModule: produces evaluatable JS string", async () => {
  const discovery = await discoverContent({
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
  });
  const manifest = await buildManifest({
    discovery,
    contentDir,
    locales: ["en", "de"],
    defaultLocale: "en",
    basePath: "/",
  });
  const src = emitManifestModule({
    manifest,
    contentDir,
    emittedFromDir: contentDir,
  });
  expect(src).toContain("const manifest =");
  expect(src).toContain("export default manifest;");
  expect(src).toContain("import(");
});
