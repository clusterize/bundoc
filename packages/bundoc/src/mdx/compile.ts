import { compile as mdxCompile } from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { PluggableList } from "unified";
import { rehypeCollectHeadings } from "./headings.ts";
import { rehypeBasePath } from "./rehype-base-path.ts";

export type HighlightingConfig = false | { light: string; dark: string };

export type CompileOptions = {
  /** Whether to compile in development mode (better stack traces). */
  development?: boolean;
  /** Build-time Shiki highlighting; `false` disables. */
  highlighting?: HighlightingConfig;
  /**
   * Site basePath. Root-relative URLs in MDX (e.g. `/foo.png`) are
   * rewritten to `<basePath>/foo.png`. Defaults to `/` (no rewrite).
   */
  basePath?: string;
};

/**
 * Compile MDX source to ESM. The resulting module exports:
 * - default: page component
 * - frontmatter: object (via remark-mdx-frontmatter)
 * - headings: HeadingItem[] (via rehypeCollectHeadings)
 */
export async function compileMdx(
  source: string,
  opts: CompileOptions = {},
): Promise<string> {
  const highlighting = opts.highlighting ?? false;
  const basePath = opts.basePath ?? "/";
  const rehypePlugins: PluggableList = [];
  if (basePath !== "/" && basePath !== "") {
    rehypePlugins.push([rehypeBasePath, { basePath }]);
  }
  rehypePlugins.push(rehypeSlug);
  rehypePlugins.push([rehypeAutolinkHeadings, { behavior: "wrap" }]);
  if (highlighting) {
    rehypePlugins.push([
      rehypeShiki,
      {
        themes: { light: highlighting.light, dark: highlighting.dark },
        // CSS-variable output so the theme can switch via `html.dark`.
        defaultColor: false,
      },
    ]);
  }
  rehypePlugins.push(rehypeCollectHeadings);

  const file = await mdxCompile(source, {
    jsxImportSource: "react",
    development: opts.development ?? false,
    remarkPlugins: [
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "frontmatter" }],
      remarkGfm,
    ],
    rehypePlugins,
    outputFormat: "program",
    format: "mdx",
  });
  return String(file);
}
