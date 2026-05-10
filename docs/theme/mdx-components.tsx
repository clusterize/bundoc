// Optional MDX tag overrides. bundoc maps these into MDXProvider for the user.
// The .bundoc-prose wrapper in theme/index.tsx already styles raw pre/code via
// CSS, so these overrides just pass through and let the user add classes.

const components = {
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      className={[
        "text-blue-600 dark:text-blue-400 hover:underline",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  ),
};

export default components;
