import { type ComponentType, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashScrollEffect, PageModuleProvider } from "./page-module.tsx";
import {
  ManifestProvider,
  MdxComponentsProvider,
  RouteMatchProvider,
} from "./providers.tsx";
import { RouterProvider } from "./router.tsx";
import { TitleEffect } from "./title.ts";
import type { Manifest } from "./types.ts";

export type MountOptions = {
  manifest: Manifest;
  ThemeApp: ComponentType;
  mdxComponents?: Record<string, unknown>;
  /** DOM element id to mount into. Default: "root". */
  rootId?: string;
};

export function mountBundoc(opts: MountOptions): void {
  const { manifest, ThemeApp, mdxComponents, rootId = "root" } = opts;
  const target = document.getElementById(rootId) ?? document.body;
  const root = createRoot(target);
  root.render(
    <StrictMode>
      <ManifestProvider manifest={manifest}>
        <RouterProvider basePath={manifest.basePath}>
          <RouteMatchProvider>
            <TitleEffect />
            <PageModuleProvider>
              <HashScrollEffect />
              <MdxComponentsProvider components={mdxComponents}>
                <ThemeApp />
              </MdxComponentsProvider>
            </PageModuleProvider>
          </RouteMatchProvider>
        </RouterProvider>
      </ManifestProvider>
    </StrictMode>,
  );
}
