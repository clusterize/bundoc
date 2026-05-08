import { resolve, join } from "node:path";
import { mkdir, stat } from "node:fs/promises";

export async function scaffold(dir: string) {
  const root = resolve(process.cwd(), dir);
  if (await fileExists(join(root, "bundoc.config.ts"))) {
    console.error(`[bundoc] ${root} already contains a bundoc.config.ts. Aborting.`);
    process.exit(1);
  }
  await mkdir(join(root, "content"), { recursive: true });
  await mkdir(join(root, "theme"), { recursive: true });

  await Bun.write(
    join(root, "bundoc.config.ts"),
    `import { defineConfig } from "bundoc/config";

export default defineConfig({
  locales: ["en"],
  defaultLocale: "en",
});
`,
  );

  await Bun.write(
    join(root, "content", "index.mdx"),
    `---
title: Welcome
---

# Welcome

Edit \`content/index.mdx\` and the page hot-reloads.
`,
  );

  await Bun.write(
    join(root, "theme", "index.tsx"),
    `import { PageOutlet, Link, useNav, useCurrentPage, type NavNode } from "bundoc/theme";

export default function ThemeApp() {
  const nav = useNav();
  const page = useCurrentPage();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <aside style={{ borderRight: "1px solid #eee", padding: "1rem" }}>
        <Link to="/" style={{ fontWeight: 700 }}>{page.title || "Home"}</Link>
        <Sidebar nodes={nav.tree.children} />
      </aside>
      <main style={{ padding: "2rem", maxWidth: 800 }}>
        <PageOutlet fallback={<p>Loading…</p>} />
      </main>
    </div>
  );
}

function Sidebar({ nodes }: { nodes: NavNode[] }) {
  if (!nodes.length) return null;
  return (
    <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
      {nodes.map((n, i) => (
        <li key={i}>
          {n.route ? <Link to={n.route}>{n.label}</Link> : <strong>{n.label}</strong>}
          {n.children.length ? <Sidebar nodes={n.children} /> : null}
        </li>
      ))}
    </ul>
  );
}
`,
  );

  await Bun.write(
    join(root, ".gitignore"),
    `node_modules
.bundoc
dist
`,
  );

  console.log(`bundoc init → ${dir}`);
  console.log(`Next: cd ${dir} && bunx bundoc dev`);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
