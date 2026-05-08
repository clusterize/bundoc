import { compile as mdxCompile } from "@mdx-js/mdx";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { rehypeCollectHeadings } from "./headings.ts";

export type CompileOptions = {
  /** Whether to compile in development mode (better stack traces). */
  development?: boolean;
};

/**
 * Compile MDX source to ESM. The resulting module exports:
 * - default: page component
 * - frontmatter: object (via remark-mdx-frontmatter)
 * - headings: HeadingItem[] (via rehypeCollectHeadings)
 */
export async function compileMdx(source: string, opts: CompileOptions = {}): Promise<string> {
  const file = await mdxCompile(source, {
    jsxImportSource: "react",
    development: opts.development ?? false,
    remarkPlugins: [
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "frontmatter" }],
      remarkGfm,
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: "wrap" }],
      rehypeCollectHeadings,
    ],
    outputFormat: "program",
    format: "mdx",
  });
  return String(file);
}
