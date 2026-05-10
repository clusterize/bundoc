import { useMemo } from "react";
import { useManifest, useRouteMatch } from "../runtime/providers.tsx";
import { useRouter } from "../runtime/router.tsx";
import { buildHref } from "../runtime/route-resolver.ts";
import type { NavNode, Heading } from "../runtime/types.ts";

export type UseLocaleResult = {
  locale: string;
  locales: string[];
  defaultLocale: string;
  /** Switch to a different locale, navigating to the equivalent URL. */
  setLocale: (next: string) => void;
};

export function useLocale(): UseLocaleResult {
  const manifest = useManifest();
  const match = useRouteMatch();
  const { navigate, basePath } = useRouter();
  return useMemo(
    () => ({
      locale: match.locale,
      locales: manifest.locales,
      defaultLocale: manifest.defaultLocale,
      setLocale: (next: string) => {
        if (next === match.locale) return;
        const href = buildHref({
          route: match.route,
          locale: next,
          defaultLocale: manifest.defaultLocale,
          basePath,
        });
        navigate(href);
      },
    }),
    [manifest, match, navigate, basePath],
  );
}

export type UseNavResult = {
  /** Locale-specific navigation tree (root NavNode; iterate `.children`). */
  tree: NavNode;
  /** All routes for the current locale, in canonical order. */
  flat: string[];
  /** Current route path (logical, no basePath, no locale prefix). */
  currentPath: string;
  /** Previous route in the order (or null). */
  prev: { route: string; title: string } | null;
  /** Next route in the order (or null). */
  next: { route: string; title: string } | null;
};

export function useNav(): UseNavResult {
  const manifest = useManifest();
  const match = useRouteMatch();
  return useMemo<UseNavResult>(() => {
    const tree = manifest.nav[match.locale] ?? { label: "", order: 0, children: [] };
    const flat = manifest.order[match.locale] ?? [];
    const idx = flat.indexOf(match.route);
    const titleAt = (route: string | undefined): { route: string; title: string } | null => {
      if (!route) return null;
      const entry = manifest.routes[route]?.[match.locale];
      return entry ? { route, title: entry.title } : { route, title: route };
    };
    return {
      tree,
      flat,
      currentPath: match.route,
      prev: idx > 0 ? titleAt(flat[idx - 1]) : null,
      next: idx >= 0 && idx < flat.length - 1 ? titleAt(flat[idx + 1]) : null,
    };
  }, [manifest, match]);
}

export function useTOC(): Heading[] {
  // Headings come from the loaded MDX module. PageOutlet is what loads it,
  // and the theme uses `useCurrentPage()` for that. To make `useTOC()` cheap
  // and synchronous like the API promises, we read the cached module via
  // `useCurrentPage().headings`.
  return useCurrentPage().headings;
}

export type CurrentPage = {
  route: string;
  locale: string;
  frontmatter: Record<string, unknown>;
  headings: Heading[];
  fallback: boolean;
  notFound: boolean;
  title: string;
};

import { usePageModule } from "./internal-page.ts";

export function useCurrentPage(): CurrentPage {
  const match = useRouteMatch();
  const mod = usePageModule();
  return {
    route: match.route,
    locale: match.locale,
    frontmatter: match.entry?.frontmatter ?? {},
    headings: mod?.headings ?? [],
    fallback: !!match.fallback,
    notFound: !!match.notFound,
    title: match.entry?.title ?? "",
  };
}

export function useFrontmatter<T extends Record<string, unknown> = Record<string, unknown>>(): T {
  return useCurrentPage().frontmatter as T;
}

// useSearchIndex lives in ./search.ts to keep its Orama dependency tree
// import-isolated. Re-exported by `theme/index.ts`.

export type UseLink = {
  /** Locale-aware href for a route. */
  href: (route: string, opts?: { locale?: string }) => string;
  /** Programmatic navigation (locale-aware). */
  navigate: (route: string, opts?: { locale?: string; replace?: boolean }) => void;
};

export function useLink(): UseLink {
  const manifest = useManifest();
  const match = useRouteMatch();
  const { navigate, basePath } = useRouter();
  return useMemo<UseLink>(
    () => ({
      href: (route, opts) =>
        buildHref({
          route,
          locale: opts?.locale ?? match.locale,
          defaultLocale: manifest.defaultLocale,
          basePath,
        }),
      navigate: (route, opts) => {
        const href = buildHref({
          route,
          locale: opts?.locale ?? match.locale,
          defaultLocale: manifest.defaultLocale,
          basePath,
        });
        navigate(href, { replace: opts?.replace });
      },
    }),
    [manifest, match, navigate, basePath],
  );
}
