import type { Element, Root, Text } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type HeadingItem = { id: string; text: string; level: number };

/**
 * rehype plugin that walks H1–H6, captures id/text/level, and injects an
 * MDX ESM export `export const headings = [...]` into the compiled module.
 *
 * Must run AFTER `rehype-slug` so each heading already has an `id`.
 */
const remarkLikeMdxNode = (headings: HeadingItem[]) => ({
  type: "mdxjsEsm",
  value: `export const headings = ${JSON.stringify(headings)};`,
  data: {
    estree: {
      type: "Program",
      sourceType: "module",
      body: [
        {
          type: "ExportNamedDeclaration",
          source: null,
          specifiers: [],
          declaration: {
            type: "VariableDeclaration",
            kind: "const",
            declarations: [
              {
                type: "VariableDeclarator",
                id: { type: "Identifier", name: "headings" },
                init: {
                  type: "ArrayExpression",
                  elements: headings.map((h) => ({
                    type: "ObjectExpression",
                    properties: [
                      makeProp("id", { type: "Literal", value: h.id }),
                      makeProp("text", { type: "Literal", value: h.text }),
                      makeProp("level", { type: "Literal", value: h.level }),
                    ],
                  })),
                },
              },
            ],
          },
        },
      ],
    },
  },
});

function makeProp(name: string, value: unknown) {
  return {
    type: "Property",
    key: { type: "Identifier", name },
    value,
    kind: "init",
    method: false,
    shorthand: false,
    computed: false,
  };
}

export const rehypeCollectHeadings: Plugin<[], Root> = () => {
  return (tree) => {
    const headings: HeadingItem[] = [];
    visit(tree, "element", (node: Element) => {
      const m = /^h([1-6])$/.exec(node.tagName);
      if (!m) return;
      const level = Number(m[1]);
      const id = (node.properties?.id as string | undefined) ?? "";
      const text = extractText(node);
      headings.push({ id, text, level });
    });
    // Inject the export node at the top of the tree.
    (tree.children as unknown[]).unshift(remarkLikeMdxNode(headings));
  };
};

function extractText(node: Element): string {
  let out = "";
  for (const child of node.children) {
    if (child.type === "text") {
      out += (child as Text).value;
    } else if (child.type === "element") {
      out += extractText(child as Element);
    }
  }
  return out.trim();
}
