# bundoc

A Bun-native CLI for MDX documentation sites. The *content* is `.mdx`,
the *theme* is your React app. bundoc supplies the content pipeline,
router, search, and a small set of hooks; you ship the theme.

## Quick start

```bash
bunx bundoc init my-docs
cd my-docs
bun install
bunx bundoc dev
```

That scaffolds `bundoc.config.ts`, `content/`, and `theme/`, then
serves the dev site with HMR at `http://localhost:3000`.

## Commands

| Command | What it does |
|---------|--------------|
| `bundoc dev` | Dev server with HMR. |
| `bundoc build` | Static site to `dist/`. |
| `bundoc preview` | Serve `dist/` with SPA fallback. |
| `bundoc init <dir>` | Scaffold a new project. |

## What's in the box

- **MDX content pipeline** — frontmatter, GFM, headings/TOC extraction.
- **File-system routing** with `_meta.json` overrides for ordering and
  labels, plus `<Link>` for locale-aware navigation.
- **i18n** via `<name>.<locale>.mdx` filename suffix, with automatic
  default-locale fallback.
- **Build-time search** — Orama BM25 + typo tolerance, one ~25 KB
  index per locale, fully offline.
- **Optional Shiki highlighting** with dual-theme CSS variables
  (`mdx.highlighting` in the config).
- **bunfig.toml plugins** — `[serve.static].plugins` apply to both
  `bundoc dev` and `bundoc build`.

## Documentation

The full docs live in [`docs/`](./docs) and are themselves a bundoc
site. To run them locally:

```bash
cd docs
bun install
bunx bundoc dev
```

Topics covered:

- [Installation and project structure](./docs/content/getting-started/)
- [Writing content, routing, i18n](./docs/content/guides/)
- [API: hooks, components, CLI, config](./docs/content/api/)
- [Frontmatter, _meta.json, roadmap](./docs/content/reference/)

## Status

bundoc is pre-1.0. The hooks documented in
[`docs/content/api/hooks.mdx`](./docs/content/api/hooks.mdx) are
stable; internals are not. The deferred work is listed in
[`docs/content/reference/roadmap.mdx`](./docs/content/reference/roadmap.mdx)
and `PLAN.md`.

## License

MIT
