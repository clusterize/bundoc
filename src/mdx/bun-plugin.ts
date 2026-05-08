import type { BunPlugin } from "bun";
import { compileMdx } from "./compile.ts";

/**
 * Bun loader plugin that compiles `.mdx` to JSX on import. Apply via
 * `Bun.plugin(mdxBunPlugin())` (process-wide) or pass to `Bun.build({ plugins })`.
 */
export function mdxBunPlugin(opts: { development?: boolean } = {}): BunPlugin {
  return {
    name: "bundoc-mdx",
    setup(build) {
      build.onLoad({ filter: /\.mdx$/ }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const compiled = await compileMdx(source, { development: opts.development });
        return {
          contents: compiled,
          loader: "jsx",
        };
      });
    },
  };
}
