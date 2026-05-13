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
