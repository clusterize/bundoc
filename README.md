# bundoc

A Bun-native CLI for MDX documentation sites with a bring-your-own-theme
model. bundoc owns content discovery, MDX compile, routing, i18n, and
build-time search; you own every pixel of the UI.

- 📦 Package: [`packages/bundoc/`](./packages/bundoc) — published to npm as `bundoc`.
- 🌐 Docs: [bundoc.dev](https://bundoc.dev) — source in [`packages/docs/`](./packages/docs).

For the user-facing intro, quick start, hooks reference, and config, see
[`packages/bundoc/README.md`](./packages/bundoc/README.md).

---

## Repo layout

This is a Bun workspace. The root is private and only hosts the
`packages/*` glob; each member is a real package with its own
`package.json`.

```
bundoc/
├─ packages/
│  ├─ bundoc/      # the published library + CLI
│  └─ docs/        # bundoc.dev — also the canonical example consumer
├─ PLAN.md         # internal v1 design doc
├─ DOCS_PLAN.md    # docs-site handoff plan
├─ PDF_PLAN.md     # planned `bundoc pdf` feature
└─ CLAUDE.md       # repo conventions for AI coding agents
```

`packages/docs` depends on `bundoc` via `"workspace:*"`, so edits to
`packages/bundoc/src/` are picked up live by `bun --filter bundoc-docs dev`
— there is no install snapshot in between.

---

## Develop on bundoc

```bash
git clone https://github.com/clusterize/bundoc.git
cd bundoc
bun install

# Run the docs site (uses your local bundoc via the workspace symlink)
bun --filter bundoc-docs dev

# Tests + typecheck (both must be green before committing)
bun test
bunx tsc -p packages/bundoc --noEmit
```

Tests are co-located: `foo.ts` next to `foo.test.ts`. The dev-server
integration test lives at
`packages/bundoc/src/__tests__/dev-integration.test.ts`.

### Workspace conventions

- **Bun-only.** All scripts assume Bun ≥ 1.3. No Node, no npm, no pnpm.
  See [CLAUDE.md](./CLAUDE.md) for the full set of Bun-first conventions
  (prefer `Bun.file` over `node:fs`, `Bun.serve` over Express, etc.).
- **No `file:` references between workspace members.** The docs package
  must depend on `bundoc` via `"workspace:*"`. Using `file:..` makes Bun
  create a content-addressed snapshot under
  `node_modules/.bun/bundoc@root/...` that does *not* update when you
  edit `packages/bundoc/src/`, silently breaking the inner loop.
- **`.bundoc/cache/` is the build product.** bundoc pre-compiles MDX
  into `.tsx` shims because `Bun.serve`'s HTML-import bundler doesn't
  reliably honor `Bun.plugin()`-registered `.mdx` loaders. The watcher
  recompiles single files on change and rebuilds the manifest on
  add/remove.

---

## Internal docs

The `*_PLAN.md` files at the repo root are working design docs for
features in progress. They are intentionally kept here (not in
`packages/docs/`) because they describe bundoc's internals, not user
behavior.

- [PLAN.md](./PLAN.md) — v1 architecture and decisions. Read this
  before non-trivial changes.
- [DOCS_PLAN.md](./DOCS_PLAN.md) — design of the public docs site.
- [PDF_PLAN.md](./PDF_PLAN.md) — proposed `bundoc pdf` command.
- [PERSISTENCE_PLAN.md](./PERSISTENCE_PLAN.md) — record of the
  msgpack → JSON switch for search indexes. Archived.

User-facing documentation lives at [bundoc.dev](https://bundoc.dev).

---

## License

MIT — see [LICENSE](./LICENSE).
