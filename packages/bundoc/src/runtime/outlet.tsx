import { type ReactNode } from "react";
import { useRouteMatch, useMdxComponents } from "./providers.tsx";
import { usePageLoadState } from "./page-module.tsx";

/**
 * Renders the MDX page for the current route. Reads the loaded module from
 * `PageModuleProvider`. The theme controls the loading/error/notFound UI.
 */
export function PageOutlet({
  fallback = null,
  notFound = <DefaultNotFound />,
  errorFallback,
}: {
  fallback?: ReactNode;
  notFound?: ReactNode;
  errorFallback?: (error: unknown) => ReactNode;
} = {}) {
  const match = useRouteMatch();
  const components = useMdxComponents();
  const state = usePageLoadState();

  if (match.notFound || !match.entry) return <>{notFound}</>;
  if (!state || state.status === "loading") return <>{fallback}</>;
  if (state.status === "error") {
    return <>{errorFallback ? errorFallback(state.error) : <DefaultErrorPanel error={state.error} />}</>;
  }
  const Page = state.mod.default;
  return <Page components={components} />;
}

function DefaultNotFound() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>404 — Not found</h1>
      <p>This page does not exist.</p>
    </div>
  );
}

function DefaultErrorPanel({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.stack ?? error.message : String(error);
  return (
    <div style={{ padding: "1rem", border: "1px solid #f00", color: "#900", whiteSpace: "pre-wrap" }}>
      <strong>Error loading page</strong>
      <pre>{msg}</pre>
    </div>
  );
}
