import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useLink } from "./hooks.ts";

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** Logical route, e.g. `/faq/installation`. NOT a full URL. */
  to: string;
  /** Override locale (default: current). */
  locale?: string;
  /** Replace the current history entry instead of pushing. */
  replace?: boolean;
  children?: ReactNode;
};

/**
 * Locale-aware client-side link. Falls back to a normal anchor for modified
 * clicks (cmd-click, middle-click, etc) so the browser handles them as expected.
 */
export function Link({ to, locale, replace, onClick, children, ...rest }: LinkProps) {
  const { href, navigate } = useLink();
  const target = href(to, { locale });

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    e.preventDefault();
    navigate(to, { locale, replace });
  };

  return (
    <a {...rest} href={target} onClick={handleClick}>
      {children}
    </a>
  );
}
