import { expect, test } from "bun:test";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rehypeBasePath } from "./rehype-base-path.ts";

async function run(md: string, basePath: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeBasePath, { basePath })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

test("prefixes root-relative img src", async () => {
  const html = await run(`![alt](/foo.png)`, "/docs");
  expect(html).toContain('src="/docs/foo.png"');
});

test("prefixes root-relative anchor href", async () => {
  const html = await run(`[link](/guides/install)`, "/docs");
  expect(html).toContain('href="/docs/guides/install"');
});

test("leaves protocol-relative URLs untouched", async () => {
  const html = await run(`![alt](//cdn.example/foo.png)`, "/docs");
  expect(html).toContain('src="//cdn.example/foo.png"');
});

test("leaves absolute-scheme URLs untouched", async () => {
  const html = await run(`[link](https://example.com/x)`, "/docs");
  expect(html).toContain('href="https://example.com/x"');
});

test("leaves mailto/tel/data URLs untouched", async () => {
  const html = await run(`[m](mailto:a@b.c)`, "/docs");
  expect(html).toContain('href="mailto:a@b.c"');
  const html2 = await run(`[t](tel:+1234)`, "/docs");
  expect(html2).toContain('href="tel:+1234"');
  const html3 = await run(`![a](data:image/png;base64,AA==)`, "/docs");
  expect(html3).toContain('src="data:image/png;base64,AA=="');
});

test("leaves fragment and query-only URLs untouched", async () => {
  const html = await run(`[a](#section)`, "/docs");
  expect(html).toContain('href="#section"');
});

test("leaves relative paths untouched", async () => {
  const html = await run(`![a](./foo.png)`, "/docs");
  expect(html).toContain('src="./foo.png"');
  const html2 = await run(`![a](foo.png)`, "/docs");
  expect(html2).toContain('src="foo.png"');
});

test("does not double-prefix already-prefixed URLs", async () => {
  const html = await run(`![a](/docs/foo.png)`, "/docs");
  expect(html).toContain('src="/docs/foo.png"');
  expect(html).not.toContain("/docs/docs/");
});

test("treats basePath itself as a valid URL", async () => {
  const html = await run(`<a href="/docs">root</a>`, "/docs");
  expect(html).toContain('href="/docs"');
});

test("rewrites <img srcset> entries", async () => {
  const html = await run(
    `<img src="/foo.png" srcset="/foo.png 1x, /foo@2x.png 2x" />`,
    "/docs",
  );
  expect(html).toContain('src="/docs/foo.png"');
  expect(html).toContain("/docs/foo.png 1x, /docs/foo@2x.png 2x");
});

test("rewrites <video poster> and <source src>", async () => {
  const html = await run(
    `<video poster="/p.jpg"><source src="/v.mp4" /></video>`,
    "/docs",
  );
  expect(html).toContain('poster="/docs/p.jpg"');
  expect(html).toContain('src="/docs/v.mp4"');
});

test("is a no-op when basePath is /", async () => {
  const html = await run(`![a](/foo.png)`, "/");
  expect(html).toContain('src="/foo.png"');
});

test("is a no-op when basePath is empty", async () => {
  const html = await run(`![a](/foo.png)`, "");
  expect(html).toContain('src="/foo.png"');
});
