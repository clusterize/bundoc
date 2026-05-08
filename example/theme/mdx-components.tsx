// Optional MDX tag overrides. bundoc maps these into MDXProvider for the user.
// Code blocks live here — pre/code emit unstyled by default. We ship a tiny
// CSS-only treatment so the override path is exercised end-to-end.

const components = {
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre {...props} className={["bundoc-code", props.className].filter(Boolean).join(" ")} />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code {...props} className={["bundoc-code-inline", props.className].filter(Boolean).join(" ")} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} className={["bundoc-link", props.className].filter(Boolean).join(" ")} />
  ),
};

export default components;
