import type { BunPlugin } from "bun";
import { resolve as resolvePath, dirname } from "node:path";
import { stat } from "node:fs/promises";

/**
 * Bun bundler plugin that pins `react`, `react-dom`, and a few related
 * specifiers to one canonical install. Without this, when bundoc is consumed
 * via `file:..` linking from `example/`, the bundler can resolve React from
 * both `bundoc/node_modules/react` and `example/node_modules/react`, causing
 * "Invalid hook call" because the user theme and bundoc's runtime end up
 * referencing distinct module instances.
 *
 * Pass the consumer's project root as `consumerRoot`; we resolve `react` from
 * there once, then alias all variants to that single file.
 */
export async function dedupeReactPlugin(consumerRoot: string): Promise<BunPlugin> {
  const reactRoot = await findPkgRoot(consumerRoot, "react");
  const reactDomRoot = await findPkgRoot(consumerRoot, "react-dom");
  const jsxRuntime = reactRoot ? resolvePath(reactRoot, "jsx-runtime.js") : null;
  const jsxDevRuntime = reactRoot ? resolvePath(reactRoot, "jsx-dev-runtime.js") : null;
  const reactClient = reactDomRoot ? resolvePath(reactDomRoot, "client.js") : null;

  return {
    name: "bundoc-dedupe-react",
    setup(build) {
      const aliasFor = async (specifier: string): Promise<string | null> => {
        if (!reactRoot) return null;
        if (specifier === "react") return resolvePath(reactRoot, "index.js");
        if (specifier === "react/jsx-runtime") return jsxRuntime;
        if (specifier === "react/jsx-dev-runtime") return jsxDevRuntime;
        if (specifier === "react-dom" && reactDomRoot)
          return resolvePath(reactDomRoot, "index.js");
        if (specifier === "react-dom/client" && reactClient) return reactClient;
        return null;
      };

      build.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, async ({ path }) => {
        const aliased = await aliasFor(path);
        if (!aliased) return undefined;
        return { path: aliased };
      });
    },
  };
}

async function findPkgRoot(fromDir: string, pkgName: string): Promise<string | null> {
  let dir = resolvePath(fromDir);
  while (true) {
    const candidate = resolvePath(dir, "node_modules", pkgName);
    try {
      const s = await stat(candidate);
      if (s.isDirectory()) return candidate;
    } catch {
      // not here
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
