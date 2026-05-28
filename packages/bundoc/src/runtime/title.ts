import { useEffect } from "react";
import { useManifest, useRouteMatch } from "./providers.tsx";

/**
 * Renders nothing. Keeps `document.title` in sync with the current
 * route's title, applying `manifest.titleTemplate` if configured.
 * The template's `%s` is replaced by the page title; without a template
 * the bare title is used.
 */
export function TitleEffect(): null {
  const manifest = useManifest();
  const match = useRouteMatch();
  const pageTitle = match.entry?.title ?? "";
  const template = manifest.titleTemplate;
  useEffect(() => {
    if (typeof document === "undefined" || !pageTitle) return;
    document.title = template ? template.replace("%s", pageTitle) : pageTitle;
  }, [pageTitle, template]);
  return null;
}
