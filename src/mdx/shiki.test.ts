import { test, expect } from "bun:test";
import { compileMdx } from "./compile.ts";

const fixture = `# Heading

Some prose.

\`\`\`ts
const x: number = 1;
\`\`\`

## Second heading
`;

test("compileMdx: highlighting off → plain pre/code, no Shiki spans", async () => {
  const out = await compileMdx(fixture);
  // No Shiki style markers.
  expect(out).not.toMatch(/--shiki-/);
  // Headings still extracted.
  expect(out).toMatch(/headings\s*=\s*\[/);
  expect(out).toContain("Heading");
  expect(out).toContain("Second heading");
});

test("compileMdx: highlighting on → emits Shiki dual-theme CSS vars", async () => {
  const out = await compileMdx(fixture, {
    highlighting: { light: "github-light", dark: "github-dark" },
  });
  // Shiki with defaultColor:false emits --shiki-light / --shiki-dark CSS vars.
  expect(out).toMatch(/--shiki-light/);
  expect(out).toMatch(/--shiki-dark/);
  // The TOC extractor still runs after Shiki — headings are intact.
  expect(out).toMatch(/headings\s*=\s*\[/);
  expect(out).toContain("Heading");
  expect(out).toContain("Second heading");
});
