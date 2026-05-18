import { expect, test } from "bun:test";
import { compileMdx } from "./compile.ts";

test("compileMdx: emits default + frontmatter + headings exports", async () => {
  const src = `---
title: Hello
sidebar:
  order: 1
---

# Hello world

Some prose.

## A subsection

More prose.
`;
  const out = await compileMdx(src);
  expect(out).toContain("export default");
  expect(out).toContain("frontmatter");
  expect(out).toContain("headings");
  // Heading data appears as a JS array literal.
  expect(out).toMatch(/headings\s*=\s*\[/);
});

test("compileMdx: GFM tables compile", async () => {
  const src = `| a | b |
|---|---|
| 1 | 2 |
`;
  const out = await compileMdx(src);
  expect(out).toContain("table");
});

test("compileMdx: rewrites root-relative URLs under basePath", async () => {
  const src = `# Page

![hero](/images/hero.png)

See the [install guide](/guides/install).
`;
  const out = await compileMdx(src, { basePath: "/docs" });
  expect(out).toContain('"/docs/images/hero.png"');
  expect(out).toContain('"/docs/guides/install"');
});

test("compileMdx: default basePath leaves URLs unrewritten", async () => {
  const src = `![hero](/images/hero.png)\n`;
  const out = await compileMdx(src);
  expect(out).toContain('"/images/hero.png"');
  expect(out).not.toContain("/docs/");
});
