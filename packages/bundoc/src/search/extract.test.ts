import { expect, test } from "bun:test";
import { extractSearchable } from "./extract.ts";

test("extracts title, sections, body from MDX", () => {
  const src = `---
title: Frontmatter Title
---

# Heading One

Some prose with \`inline\` code.

## Section A

Text in A.

\`\`\`ts
const x = 1;
\`\`\`

## Section B

Text in B.
`;
  const doc = extractSearchable(src, "fallback");
  expect(doc.title).toBe("Heading One");
  expect(doc.sections.length).toBeGreaterThanOrEqual(3);
  expect(doc.body).toContain("Some prose with inline code");
  expect(doc.body).toContain("const x = 1;");
  // Section A should have its own text bucket.
  const a = doc.sections.find((s) => s.heading === "Section A");
  expect(a?.text).toContain("Text in A");
});

test("falls back to passed title when no h1 present", () => {
  const doc = extractSearchable("Just prose.", "Installation");
  expect(doc.title).toBe("Installation");
  expect(doc.body).toBe("Just prose.");
});

test("folds frontmatter fields into body and first section", () => {
  const src = `---
title: T
description: Inbetriebnahme der clusterize-Appliance
---

# Heading

Prose without the description text.
`;
  const doc = extractSearchable(src, "fallback", {
    frontmatter: { description: "Inbetriebnahme der clusterize-Appliance" },
    frontmatterFields: ["description"],
  });
  expect(doc.body).toContain("Inbetriebnahme der clusterize-Appliance");
  const h = doc.sections.find((s) => s.heading === "Heading");
  expect(h?.text).toContain("Inbetriebnahme der clusterize-Appliance");
});

test("empty frontmatterFields is a no-op", () => {
  const src = `---
title: T
description: Inbetriebnahme der clusterize-Appliance
---

# Heading

Prose without the description text.
`;
  const doc = extractSearchable(src, "fallback", {
    frontmatter: { description: "Inbetriebnahme der clusterize-Appliance" },
    frontmatterFields: [],
  });
  expect(doc.body).not.toContain("Inbetriebnahme");
});

test("array-valued frontmatter is flattened", () => {
  const src = `# Title

Body prose.
`;
  const doc = extractSearchable(src, "fallback", {
    frontmatter: { keywords: ["alpha", "beta", "gamma"] },
    frontmatterFields: ["keywords"],
  });
  expect(doc.body).toContain("alpha");
  expect(doc.body).toContain("beta");
  expect(doc.body).toContain("gamma");
});

test("page with zero sections gets a synthetic section from frontmatter", () => {
  const doc = extractSearchable("", "fallback", {
    frontmatter: { description: "Lonely description" },
    frontmatterFields: ["description"],
  });
  expect(doc.sections.length).toBe(1);
  expect(doc.sections[0]?.text).toContain("Lonely description");
  expect(doc.body).toContain("Lonely description");
});

test("strips JSX expressions", () => {
  const src = `# Hi

import { Foo } from './foo';

Hello <Foo bar="baz" /> world.

{1 + 2}
`;
  const doc = extractSearchable(src, "x");
  expect(doc.body).toContain("Hi");
  expect(doc.body).toContain("Hello");
  expect(doc.body).toContain("world");
  expect(doc.body).not.toContain("import");
  expect(doc.body).not.toContain("baz");
});
