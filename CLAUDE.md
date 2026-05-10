---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# bundoc

A Bun-native CLI for MDX documentation sites. The *content* is `.mdx`, the
*theme* is a user-owned React app. bundoc supplies the content pipeline,
router, search, and a small set of hooks; the theme renders.

`PLAN.md` is the v1 design doc (read this before non-trivial changes).
`DOCS_PLAN.md` is the handoff plan for building the public docs site.
`README.md` is the user-facing entry point.

## Repo layout

- `src/cli/` — argv dispatch + per-command entry (dev/build/preview/init).
- `src/config/` — `defineConfig` + `loadConfig` (reads `bundoc.config.ts`).
- `src/content/` — content discovery (filename → route, locale parsing) and
  manifest building (tree + flat map + prev/next + fallback synthesis).
- `src/mdx/` — MDX compile pipeline (`@mdx-js/mdx` + remark/rehype defaults
  + custom `rehypeCollectHeadings`). Also a Bun bundler plugin that few
  paths actually use.
- `src/runtime/` — providers (Manifest, RouteMatch, MdxComponents,
  PageModule), the ~150-line CSR router, and `mountBundoc` (the entry).
- `src/theme/` — public hooks/components (`useNav`, `useLocale`,
  `useCurrentPage`, `useTOC`, `useLink`, `useSearchIndex`, `<Link>`).
  Re-exported via the `bundoc/theme` subpath export.
- `src/search/` — plaintext extractor (MDAST) + per-locale Orama indexer.
- `src/server/` — dev server (Bun.serve + watcher), static build
  (Bun.build), preview, cache writer.
- `src/scaffold/` — `bundoc init` templates.
- `docs/` — the public docs site AND the integration-test target. Doubles
  as the canonical example consumer of bundoc.

## Key non-obvious things

- **MDX is pre-compiled to `.tsx` shims** in `.bundoc/cache/pages/`, NOT
  imported live. Bun.serve's HTML-import bundler doesn't reliably pick up
  `Bun.plugin()`-registered `.mdx` loaders, so the cache rebuild compiles
  each MDX to TSX and the manifest's importer thunks point at those
  shims. Watcher recompiles single files on `change`, rebuilds the
  manifest on add/remove.
- **`.bundoc/cache/` is the build product**: `manifest.ts` (the virtual
  manifest), `pages/*.tsx` (compiled MDX), `search/<locale>.bin`
  (persisted Orama indexes), `entry.tsx`/`theme.tsx`/`mdx-components.tsx`
  (synthesized shims), `index.html` (SPA shell). Bun.serve uses these
  directly; Bun.build entrypoints from `index.html`.
- **React dedupe**: when a project consumes bundoc via `file:..` linking
  (docs/ does), Bun auto-installs peer deps in BOTH locations and
  React ends up loaded twice → "Invalid hook call". The fix is `peer =
  false` in the consumer's `bunfig.toml` so the bundler resolves a single
  React via path-walk to bundoc's install. See `src/server/dedupe-react.ts`
  for the fallback plugin (Bun.serve's HTML bundler ignores
  `Bun.plugin()`, so the dedupe plugin is informational only — the real
  fix is the bunfig switch).
- **bunfig plugin loader**: `Bun.serve` auto-loads
  `[serve.static].plugins`; `Bun.build` does NOT. `src/server/load-bunfig-plugins.ts`
  bridges this so Tailwind etc. apply to `bundoc build` too.
- **i18n URL convention**: default locale unprefixed (`/foo`),
  others prefixed (`/de/foo`). Locale parsing happens at filename level
  (`foo.de.mdx`) and route resolution.
- **Search indexes are static files**: build-time Orama indexes (one per
  locale, ~25 KB) live at `dist/_bundoc/search/<locale>.bin`. The
  runtime hook `useSearchIndex()` lazy-fetches and queries client-side.
  Fully offline, no server runtime.

## Tests

Co-located: `foo.ts` next to `foo.test.ts`. Integration tests for the dev
server live in `src/__tests__/dev-integration.test.ts`. Run all: `bun
test`. Typecheck: `bunx tsc -p . --noEmit`. Both should be green before
committing.

When changing the manifest shape or content discovery, update the docs
content tests too — they assert exact route lists.

---

# Bun conventions

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
