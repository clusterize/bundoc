import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Manifest } from "./types.ts";
import { resolveRoute, type RouteMatch } from "./route-resolver.ts";
import { useRouter, stripBasePath } from "./router.tsx";

const ManifestContext = createContext<Manifest | null>(null);
const RouteMatchContext = createContext<RouteMatch | null>(null);
const MdxComponentsContext = createContext<Record<string, unknown>>({});

export function ManifestProvider({
  manifest,
  children,
}: {
  manifest: Manifest;
  children: ReactNode;
}) {
  return <ManifestContext.Provider value={manifest}>{children}</ManifestContext.Provider>;
}

export function useManifest(): Manifest {
  const m = useContext(ManifestContext);
  if (!m) throw new Error("useManifest must be used inside <ManifestProvider>");
  return m;
}

/**
 * Computes the current route match from the router pathname + manifest.
 * Wraps the rest of the tree in `<RouteMatchContext>`.
 */
export function RouteMatchProvider({ children }: { children: ReactNode }) {
  const manifest = useManifest();
  const { pathname, basePath } = useRouter();
  const match = useMemo<RouteMatch>(() => {
    const stripped = stripBasePath(pathname, basePath);
    return resolveRoute(stripped, manifest);
  }, [pathname, basePath, manifest]);
  return <RouteMatchContext.Provider value={match}>{children}</RouteMatchContext.Provider>;
}

export function useRouteMatch(): RouteMatch {
  const m = useContext(RouteMatchContext);
  if (!m) throw new Error("useRouteMatch must be used inside <RouteMatchProvider>");
  return m;
}

export function MdxComponentsProvider({
  components,
  children,
}: {
  components?: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <MdxComponentsContext.Provider value={components ?? {}}>
      {children}
    </MdxComponentsContext.Provider>
  );
}

export function useMdxComponents(): Record<string, unknown> {
  return useContext(MdxComponentsContext);
}
