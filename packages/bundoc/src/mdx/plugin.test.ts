import { beforeAll, expect, test } from "bun:test";
import { mdxBunPlugin } from "./bun-plugin.ts";

beforeAll(() => {
  Bun.plugin(mdxBunPlugin());
});

test("import .mdx fixture: default, frontmatter, headings all present", async () => {
  // @ts-expect-error -- mdx loader provides exports
  const mod = await import("./__fixtures__/sample.mdx");
  expect(typeof mod.default).toBe("function");
  expect(mod.frontmatter?.title).toBe("Sample");
  expect(mod.frontmatter?.sidebar?.order).toBe(2);
  expect(Array.isArray(mod.headings)).toBe(true);
  const titles = mod.headings.map((h: { text: string }) => h.text);
  expect(titles).toEqual([
    "Top heading",
    "Section one",
    "Nested",
    "Section two",
  ]);
  // ids populated by rehype-slug.
  for (const h of mod.headings) {
    expect(typeof h.id).toBe("string");
    expect(h.id.length).toBeGreaterThan(0);
  }
});
