import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouteMatch } from "./providers.tsx";
import type { MdxModule } from "./types.ts";

type LoadState =
  | { status: "loading"; mod: null }
  | { status: "ready"; mod: MdxModule }
  | { status: "error"; mod: null; error: unknown };

const PageModuleContext = createContext<LoadState | null>(null);

/**
 * Loads the MDX module for the current route, caches by importerKey, and
 * exposes the module to descendants via context. Place inside `RouteMatchProvider`.
 */
export function PageModuleProvider({ children }: { children: ReactNode }) {
  const match = useRouteMatch();
  const [state, setState] = useState<LoadState>({ status: "loading", mod: null });
  const importer = match.entry?.importer;
  const importerKey = match.entry?.importerKey;

  useEffect(() => {
    if (!importer || !importerKey) {
      setState({ status: "loading", mod: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", mod: null });
    importer().then(
      (mod) => {
        if (cancelled) return;
        setState({ status: "ready", mod });
      },
      (error) => {
        if (cancelled) return;
        setState({ status: "error", mod: null, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [importerKey, importer]);

  return <PageModuleContext.Provider value={state}>{children}</PageModuleContext.Provider>;
}

export function usePageModule(): MdxModule | null {
  const s = useContext(PageModuleContext);
  return s?.mod ?? null;
}

export function usePageLoadState(): LoadState | null {
  return useContext(PageModuleContext);
}
