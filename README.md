# bundoc

A Bun-native CLI for MDX documentation sites, where the *content* is `.mdx`
and the *theme* is a user-owned React app. bundoc supplies the content
pipeline, router, search index, and a set of hooks; the theme renders.

## Quick start

```bash
bunx bundoc init my-docs
cd my-docs
bun install
bunx bundoc dev
```

## Commands

- `bundoc dev` — dev server with HMR
- `bundoc build` — emit a static `dist/`
- `bundoc preview` — serve `dist/` with SPA fallback
- `bundoc init <dir>` — scaffold a new site

## Project layout

```
my-docs/
├── bundoc.config.ts        # locales, defaultLocale, paths
├── content/                # MDX files
│   ├── index.mdx           # → /
│   ├── index.de.mdx        # → /de
│   └── faq/
│       ├── _meta.json      # ordering/labels
│       └── installation.mdx
└── theme/
    ├── index.tsx           # default-export <App/>
    └── mdx-components.tsx  # optional: MDX tag overrides
```

## Theme contract

The theme imports hooks from `bundoc/theme`:

```tsx
import {
  PageOutlet,
  Link,
  useNav,
  useLocale,
  useCurrentPage,
  useTOC,
  useSearchIndex,
} from "bundoc/theme";
```

bundoc owns the router; the theme owns rendering. See `docs/` for a
complete reference, including a Tailwind v4 layout and a ⌘K command palette.

## Search

bundoc ships build-time, fully-offline search powered by [Orama](https://docs.orama.com).
For each locale, it walks the MDX, extracts plaintext (one searchable row per
heading-section, with rehype-slug-compatible anchor ids), builds an Orama
index with BM25 + typo tolerance, and persists it to disk:

- **Dev**: served at `/_bundoc/search/<locale>.bin`.
- **Build**: copied into `dist/_bundoc/search/<locale>.bin` so the static
  output remains CDN-deployable. No server runtime required.

The theme drives the UX through `useSearchIndex()`, which lazy-fetches the
current locale's index, restores it client-side, and returns a `query` function:

```tsx
import { useSearchIndex } from "bundoc/theme";

function CommandPalette() {
  const { query, loading, error } = useSearchIndex();
  const [hits, setHits] = useState<SearchHit[]>([]);
  // call query("term", { limit: 8, tolerance: 1 }) and render hits
}
```

Each hit is `{ route, locale, title, heading, anchor, text, score }` — link
to `${route}#${anchor}` for a deep-link to the matching section.

The docs theme's `SearchPalette.tsx` is a ~150-line reference: ⌘K to open,
arrow-key navigation, debounced query, locale-aware `Link` for selection.

## bunfig.toml integration

If your theme needs build-time plugins (e.g. Tailwind via
`bun-plugin-tailwind`), declare them in your project's `bunfig.toml`:

```toml
[serve.static]
plugins = ["bun-plugin-tailwind"]
```

bundoc loads the same plugin list for both `bundoc dev` and `bundoc build`,
so dev and the static output stay in sync.

## Status

v1 ships:

- CSR with i18n (`<name>.<locale>.mdx`), default-locale fallback
- MDX: frontmatter, headings/TOC extraction, GFM
- File-system routing, locale-aware navigation, prev/next, code-splitting
- Build-time search index per locale (BM25 + typo) — fully offline
- bunfig.toml plugin loader so `bundoc build` honours `[serve.static].plugins`

Deferred: SSR/SSG (architecture leaves room — see PLAN §11), syntax
highlighting (theme owns it via `pre`/`code` overrides), vector/semantic
search (`search.semantic.embedder` config opt-in is the planned shape),
plugin/remark-rehype config exposure.
