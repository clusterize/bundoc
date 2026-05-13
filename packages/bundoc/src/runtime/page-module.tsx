import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouteMatch } from "./providers.tsx";
import { useRouter } from "./router.tsx";
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
  const [state, setState] = useState<LoadState>({
    status: "loading",
    mod: null,
  });
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

  return (
    <PageModuleContext.Provider value={state}>
      {children}
    </PageModuleContext.Provider>
  );
}

export function usePageModule(): MdxModule | null {
  const s = useContext(PageModuleContext);
  return s?.mod ?? null;
}

export function usePageLoadState(): LoadState | null {
  return useContext(PageModuleContext);
}

/**
 * Renders nothing. Scrolls to `location.hash`'s target whenever
 * - the hash changes, or
 * - the current page module transitions to `ready`
 * (whichever happens last). This lets cross-page anchor navigation work
 * without racing the lazy-load of the destination page chunk.
 */
export function HashScrollEffect(): null {
  const { hash } = useRouter();
  const state = usePageLoadState();
  useEffect(() => {
    if (!hash || state?.status !== "ready") return;
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    // Wait one frame so the rendered markup actually has the element.
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView();
    });
    return () => cancelAnimationFrame(raf);
  }, [hash, state?.status]);
  return null;
}
