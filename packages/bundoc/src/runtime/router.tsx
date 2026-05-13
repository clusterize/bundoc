import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type RouterCtx = {
  /** Current pathname (no query, no hash). */
  pathname: string;
  /** Current search string including leading '?', or ''. */
  search: string;
  /** Current hash including leading '#', or ''. */
  hash: string;
  /** Imperative navigation (pushes history entry). */
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  /** Base path the site is hosted under (no trailing slash, except '/'). */
  basePath: string;
};

const RouterContext = createContext<RouterCtx | null>(null);

export function RouterProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  const [loc, setLoc] = useState(() => readLocation());

  useEffect(() => {
    const onPop = () => setLoc(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const url = new URL(to, window.location.href);
    const sameOrigin = url.origin === window.location.origin;
    if (!sameOrigin) {
      window.location.assign(to);
      return;
    }
    if (opts?.replace) {
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    } else {
      window.history.pushState(null, "", url.pathname + url.search + url.hash);
    }
    setLoc({ pathname: url.pathname, search: url.search, hash: url.hash });
    // Scroll-to-top for plain navigations. Hash scrolling is handled by
    // `HashScrollEffect` in mount.tsx, which waits for the lazy-loaded
    // page module to be ready before looking up the anchor element.
    if (!opts?.replace && !url.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  const ctx: RouterCtx = {
    pathname: loc.pathname,
    search: loc.search,
    hash: loc.hash,
    navigate,
    basePath,
  };

  return (
    <RouterContext.Provider value={ctx}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterCtx {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouter must be used inside <RouterProvider>");
  return ctx;
}

function readLocation() {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "", hash: "" };
  }
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

/** Strip the basePath prefix from a pathname. Returns a path that always starts with `/`. */
export function stripBasePath(pathname: string, basePath: string): string {
  if (basePath === "/" || basePath === "") return ensureLeadingSlash(pathname);
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`))
    return pathname.slice(basePath.length);
  return ensureLeadingSlash(pathname);
}

function ensureLeadingSlash(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}
