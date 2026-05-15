# bundoc

A Bun-native CLI for MDX documentation sites with a **bring-your-own-theme**
model. bundoc owns the boring parts — content discovery, MDX compile,
routing, i18n, search — and exposes them as React hooks. You own every
pixel of the UI.

> **Requires [Bun](https://bun.sh) ≥ 1.3.** bundoc is Bun-only. It ships
> TypeScript source directly and uses `Bun.serve` / `Bun.build`. It will
> not run under Node.

```bash
bunx @clusterize/bundoc init my-docs
cd my-docs
bun install
bunx @clusterize/bundoc dev
```

Open `http://localhost:3000`.

---

## Why bundoc

Most docs tools either lock you into a theme (Docusaurus, Mintlify) or
make you wire up a Next.js project just to render Markdown (Nextra,
fumadocs). bundoc sits in between:

- **Content is `.mdx`** — frontmatter, GFM, headings, code blocks.
- **Theme is your React app** — no skin system, no opinionated layout.
  You import a handful of hooks from `bundoc/theme` and render whatever
  you want.
- **Everything else is built in** — file-system routing, i18n with
  fallback, build-time Orama search index, optional Shiki highlighting.

The output is a fully static SPA (`bundoc build`) — no server runtime,
no Lambda, no edge worker. Drop `dist/` on any static host.

---

## Project anatomy

`bundoc init` lays this out for you:

```
my-docs/
├─ bundoc.config.ts        # locales, paths, mdx pipeline
├─ content/
│  ├─ index.mdx            # → /
│  ├─ index.de.mdx         # → /de
│  └─ guides/
│     ├─ _meta.json        # ordering + labels (optional)
│     └─ install.mdx       # → /guides/install
├─ public/                 # static assets copied verbatim to the site
│                          # root at build, served as-is in dev
└─ theme/
   ├─ index.tsx            # your <App/> — mounted inside bundoc providers
   └─ mdx-components.tsx   # optional: { h1, code, pre, ... }
```

### Conventions

- **Default locale unprefixed**, others prefixed: `/foo` vs `/de/foo`.
- **`index.mdx`** is the directory's index route.
- **`_meta.json`** in any subdir provides `{ order, label }` overrides;
  otherwise alphabetical with `frontmatter.title` || filename.
- **Files starting with `_` or `.`** are ignored.
- **i18n filenames**: `install.mdx` is the default-locale page;
  `install.de.mdx` is the German translation. Missing translations fall
  back to the default locale automatically.

---

## Writing a theme

The theme is a regular React component. bundoc mounts it inside its
providers, so the hooks "just work."

```tsx
// theme/index.tsx
import {
  PageOutlet,
  Link,
  useNav,
  useCurrentPage,
  useLocale,
  useTOC,
} from "@clusterize/bundoc/theme";

export default function ThemeApp() {
  const nav = useNav();              // tree, flat, currentPath, prev, next
  const { locale, locales, setLocale } = useLocale();
  const page = useCurrentPage();     // { route, title, frontmatter, ... }
  const headings = useTOC();         // current page's h2/h3/h4

  return (
    <div className="layout">
      <aside>
        <LocaleSwitcher locales={locales} current={locale} onChange={setLocale} />
        <Sidebar tree={nav.tree} />
      </aside>
      <main>
        <h1>{page.title}</h1>
        <PageOutlet fallback={<p>Loading…</p>} />
      </main>
      <TOC items={headings} />
    </div>
  );
}
```

Everything is yours — styling, layout, animations, dark mode, search
palette, command bar. The [docs site](https://bundoc.dev) is itself a
bundoc theme; the source under
[`packages/docs`](https://github.com/clusterize/bundoc/tree/main/packages/docs)
is a good full-fat reference (sidebar, sticky TOC, ⌘K search, locale
switcher, dual-theme Shiki).

### MDX component overrides

`theme/mdx-components.tsx` exports the map applied to every MDX page:

```tsx
// theme/mdx-components.tsx
const components = {
  h1: (props) => <h1 className="text-3xl font-bold" {...props} />,
  a:  (props) => <a className="underline" {...props} />,
  pre: (props) => <pre className="rounded-md p-4" {...props} />,
  code: (props) => <code className="font-mono text-sm" {...props} />,
  // Custom components MDX authors can use directly inside .mdx files:
  // Callout,
};

export default components;
```

By default bundoc emits unstyled `<pre><code class="language-ts">…</code></pre>`.
Style them in the override map, or enable [Shiki](#syntax-highlighting).

### Public hooks

| Hook | What it returns |
|---|---|
| `useNav()` | `{ tree, flat, currentPath, prev, next }` for the current locale |
| `useCurrentPage()` | `{ route, locale, title, frontmatter, headings, fallback, notFound }` |
| `useTOC()` | `Heading[]` from the current page (h2/h3/h4) |
| `useLocale()` | `{ locale, locales, defaultLocale, setLocale }` |
| `useLink()` | `(to: string) => href` — locale-aware href builder |
| `useFrontmatter<T>()` | typed sugar over `useCurrentPage().frontmatter` |
| `useSearchIndex()` | lazy client that queries the build-time Orama index |
| `<Link to=… />` | locale-aware `<a>` wrapper |
| `<PageOutlet />` | the slot where the current MDX page renders |

The router and providers are runtime-owned; theme code only consumes
hooks. This keeps the contract stable across future CSR → SSR work.

---

## Configuration

`bundoc.config.ts`:

```ts
import { defineConfig } from "@clusterize/bundoc/config";

export default defineConfig({
  locales: ["en", "de"],
  defaultLocale: "en",
  contentDir: "./content",          // default
  themeEntry: "./theme/index.tsx",  // default
  basePath: "/",                    // for hosting under a subpath
  mdx: {
    highlighting: { light: "github-light", dark: "github-dark" },
  },
  search: {
    // Honour `search: false` in frontmatter. Replace or extend
    // for route-prefix exclusion, draft filtering, etc.
    filter: (page) => page.frontmatter.search !== false,
  },
});
```

### Syntax highlighting

Off by default. Set `mdx.highlighting: true` (or pass theme names) to
turn on build-time Shiki with dual light/dark CSS variables. Toggle the
active theme via an `html.dark` class on your root — your theme decides
when to apply it.

### Search

Always on. At build time bundoc walks every MDX, extracts the
plaintext, and writes one Orama BM25 index per locale to
`dist/_bundoc/search/<locale>.json`. `useSearchIndex()` lazy-fetches it
client-side. No server, no API key, no third party.

Inclusion is governed by `search.filter` in `bundoc.config.ts`. The
default predicate honours `frontmatter.search !== false` — pass your
own to exclude by route prefix, locale, draft flag, or any combination.
The predicate signature is exported as `SearchablePage` and the default
as `defaultSearchFilter`, so you can extend rather than replace it.

---

## Commands

| Command | What it does |
|---|---|
| `bundoc dev` | Dev server with HMR on `localhost:3000`. |
| `bundoc build` | Static site to `dist/`. |
| `bundoc preview` | Serve `dist/` with SPA fallback. |
| `bundoc init <dir>` | Scaffold a new project. |

Flags: `--port`, `--host`, `--out`. Run `bundoc --help`.

### `bunfig.toml` plugins

Anything you put under `[serve.static].plugins` applies to both
`bundoc dev` *and* `bundoc build` — useful for Tailwind, PostCSS, etc.

---

## Status

bundoc is **pre-1.0**. The hooks listed above are stable; internals
are not. The full reference and roadmap live at
[bundoc.dev](https://bundoc.dev).

## License

MIT — see [LICENSE](./LICENSE).
