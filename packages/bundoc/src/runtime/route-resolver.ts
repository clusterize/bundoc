import type { Manifest, ManifestRouteEntry } from "./types.ts";

export type RouteMatch = {
  /** The matched route (logical path inside content/). */
  route: string;
  /** Effective locale for this match. */
  locale: string;
  /** Whether the match comes from the default-locale fallback. */
  fallback: boolean;
  /** Whether the route does not exist at all. */
  notFound: boolean;
  entry: ManifestRouteEntry | null;
};

/**
 * Given a URL pathname (basePath already stripped), determine the (locale, route)
 * to render and look up the manifest entry, applying default-locale fallback.
 */
export function resolveRoute(pathname: string, manifest: Manifest): RouteMatch {
  const { locales, defaultLocale, routes } = manifest;
  const localeSet = new Set(locales);
  let path = pathname || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  // Trim trailing slash (except root).
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  let locale = defaultLocale;
  if (path !== "/") {
    const firstSeg = path.split("/")[1];
    if (firstSeg && firstSeg !== defaultLocale && localeSet.has(firstSeg)) {
      locale = firstSeg;
      path = `/${path.split("/").slice(2).join("/")}`;
      if (path === "" || path === "/") path = "/";
    }
  }

  const byLocale = routes[path];
  if (!byLocale) {
    return {
      route: path,
      locale,
      fallback: false,
      notFound: true,
      entry: null,
    };
  }
  const exact = byLocale[locale];
  if (exact) {
    return {
      route: path,
      locale,
      fallback: !!exact.fallback,
      notFound: false,
      entry: exact,
    };
  }
  // Should not happen if buildManifest synthesized fallbacks, but be defensive.
  const fallback = byLocale[defaultLocale];
  if (fallback) {
    return {
      route: path,
      locale,
      fallback: true,
      notFound: false,
      entry: fallback,
    };
  }
  return { route: path, locale, fallback: false, notFound: true, entry: null };
}

/**
 * Build a URL pathname for a (route, locale) pair, accounting for the
 * default-locale-unprefixed convention and basePath.
 */
export function buildHref(opts: {
  route: string;
  locale: string;
  defaultLocale: string;
  basePath: string;
}): string {
  const { route, locale, defaultLocale, basePath } = opts;
  let path = route === "/" ? "" : route;
  if (locale !== defaultLocale) {
    path = `/${locale}${path}`;
  } else if (path === "") {
    path = "/";
  }
  if (path === "") path = "/";
  if (basePath === "/" || basePath === "") return path;
  return path === "/" ? basePath : `${basePath}${path}`;
}
