import GithubSlugger from "github-slugger";
import type { Code, Heading, InlineCode, Root, Text } from "mdast";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import { visit } from "unist-util-visit";

export type ExtractedDoc = {
  /** Plain title (from heading or frontmatter, best effort). */
  title: string;
  /** Section-by-section text — useful for surfacing the matching subhead in results. */
  sections: Array<{ id: string; heading: string; level: number; text: string }>;
  /** Concatenated plaintext, useful for whole-document scoring. */
  body: string;
};

const processor = remark()
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkMdx);

/**
 * Extract searchable plaintext from MDX source. Cheap — uses the MDAST
 * parser only (no React/JSX evaluation). Code fences are kept (devs do
 * search for snippets), but JSX expressions are dropped.
 */
export function extractSearchable(
  source: string,
  fallbackTitle: string,
  opts?: {
    frontmatter?: Record<string, unknown>;
    frontmatterFields?: readonly string[];
  },
): ExtractedDoc {
  const tree = processor.parse(source) as Root;

  const sections: ExtractedDoc["sections"] = [];
  let current: ExtractedDoc["sections"][number] | undefined;
  let title = "";
  const bodyParts: string[] = [];
  const slugger = new GithubSlugger();

  for (const node of tree.children) {
    if (node.type === "yaml") continue;
    if (node.type === "heading") {
      const h = node as Heading;
      const text = nodeText(h);
      if (h.depth === 1 && !title) title = text;
      current = {
        id: slugger.slug(text),
        heading: text,
        level: h.depth,
        text: "",
      };
      sections.push(current);
      bodyParts.push(text);
      continue;
    }
    const text = nodeText(node);
    if (!text) continue;
    bodyParts.push(text);
    if (current) {
      current.text = current.text ? `${current.text}\n${text}` : text;
    } else {
      current = { id: "", heading: "", level: 0, text };
      sections.push(current);
    }
  }

  const fmText = collectFrontmatterText(
    opts?.frontmatter,
    opts?.frontmatterFields,
  );
  if (fmText) {
    bodyParts.unshift(fmText);
    if (sections[0]) {
      sections[0].text = sections[0].text
        ? `${fmText}\n${sections[0].text}`
        : fmText;
    } else {
      sections.push({ id: "", heading: "", level: 0, text: fmText });
    }
  }

  return {
    title: title || fallbackTitle,
    sections,
    body: bodyParts.join("\n").trim(),
  };
}

function collectFrontmatterText(
  fm: Record<string, unknown> | undefined,
  fields: readonly string[] | undefined,
): string {
  if (!fm || !fields?.length) return "";
  const out: string[] = [];
  for (const key of fields) {
    const v = fm[key];
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) {
      for (const x of v) if (typeof x === "string") out.push(x);
    }
  }
  return out.join(" ").trim();
}

function nodeText(node: unknown): string {
  const buf: string[] = [];
  visit(node as Root, (n) => {
    switch (n.type) {
      case "text":
        buf.push((n as Text).value);
        break;
      case "inlineCode":
        buf.push((n as InlineCode).value);
        break;
      case "code":
        buf.push((n as Code).value);
        break;
      // Skip mdxjsEsm, mdxFlowExpression, mdxTextExpression, mdxJsxFlowElement, etc.
    }
  });
  return buf.join(" ").replace(/\s+/g, " ").trim();
}
