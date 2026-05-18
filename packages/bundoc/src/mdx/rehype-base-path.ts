import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * Rewrite root-relative URLs (`/foo`) in MDX-derived HAST to include the
 * site's `basePath`. Leaves protocol-relative URLs, absolute schemes,
 * fragments, queries, relative paths, and already-prefixed URLs alone.
 *
 * Handled attributes:
 *   - `src`, `href`, `poster` on any element
 *   - `srcset` / `srcSet` on any element (comma-separated descriptor list)
 *
 * When `basePath` is `/` (or empty), the plugin is a no-op so the
 * default-config output is byte-identical to the pre-plugin output.
 *
 * Place this plugin BEFORE `rehype-autolink-headings` so heading-anchor
 * `<a href="#…">` injection sees the original tree. (Fragment URLs would
 * be skipped anyway, but keeping the order explicit is cheaper than
 * relying on it.)
 */
export const rehypeBasePath: Plugin<[{ basePath: string }], Root> = (opts) => {
  const basePath = opts?.basePath ?? "/";
  if (basePath === "/" || basePath === "") {
    return () => {};
  }
  const prefix = basePath;
  return (tree) => {
    visit(tree, "element", (node: Element) => {
      const props = node.properties;
      if (!props) return;
      for (const key of Object.keys(props)) {
        const lower = key.toLowerCase();
        if (lower === "srcset") {
          const v = props[key];
          if (typeof v === "string") props[key] = rewriteSrcset(v, prefix);
        } else if (lower === "src" || lower === "href" || lower === "poster") {
          const v = props[key];
          if (typeof v === "string") props[key] = prefixUrl(v, prefix);
        }
      }
    });
  };
};

function prefixUrl(url: string, prefix: string): string {
  if (!url.startsWith("/")) return url;
  if (url.startsWith("//")) return url;
  if (url === prefix || url.startsWith(`${prefix}/`)) return url;
  return `${prefix}${url}`;
}

function rewriteSrcset(value: string, prefix: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return part;
      const ws = trimmed.search(/\s/);
      if (ws === -1) return prefixUrl(trimmed, prefix);
      const url = trimmed.slice(0, ws);
      const descriptor = trimmed.slice(ws);
      return `${prefixUrl(url, prefix)}${descriptor}`;
    })
    .join(", ");
}
