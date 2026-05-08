# bundoc

A Bun-native CLI for MDX documentation sites, where the *content* is `.mdx`
and the *theme* is a user-owned React app. bundoc supplies the content
pipeline, router, and a set of hooks; the theme renders.

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
import { PageOutlet, Link, useNav, useLocale, useCurrentPage, useTOC } from "bundoc/theme";
```

bundoc owns the router; the theme owns rendering. See `example/` for a
complete reference.

## Status

v1: CSR, i18n, MDX with frontmatter/headings/GFM, file-system routing,
locale-aware navigation, prev/next, default-locale fallback, code-splitting.

Deferred: SSR/SSG, syntax highlighting (theme owns it via `pre`/`code` overrides),
search (`useSearchIndex()` is a stub), plugin/remark-rehype config exposure.
