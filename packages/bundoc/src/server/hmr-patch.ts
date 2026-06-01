/**
 * basePath-aware HMR WebSocket monkey-patch.
 *
 * When bundoc is mounted under a non-root `basePath` behind a reverse proxy
 * that also fronts another Bun app at `/`, both apps' HMR machinery emits
 * URLs at `/_bun/*`. The HMR WebSocket upgrade to `/_bun/hmr` carries no
 * `Referer` (verified in Firefox), so the proxy can't route it by path.
 *
 * The fix: inject a tiny `<script>` at the top of the dev HTML shell that
 * monkey-patches `window.WebSocket`. When the patched constructor sees a URL
 * whose pathname starts with `/_bun/`, it appends `?__bundoc_app=<id>` so the
 * proxy can route the upgrade by query param. HTTP `/_bun/*` assets still
 * carry `Referer` and route fine without rewriting.
 *
 * See BASEPATH_MONKEY_PATCH_PLAN.md for the full rationale and the matching
 * Caddy snippet consumers add.
 */

/**
 * Derive a URL-safe app identifier from `basePath`. Strips leading/trailing
 * slashes, replaces runs of non-`[A-Za-z0-9_-]` characters with a single
 * `-`, trims dashes, and lowercases. `appIdFromBasePath("/docs")` → `"docs"`;
 * `appIdFromBasePath("/")` → `""` (we never call it in that case anyway).
 */
export function appIdFromBasePath(basePath: string): string {
  const trimmed = basePath.replace(/^\/+/, "").replace(/\/+$/, "");
  return trimmed
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/**
 * Build the `<script>…</script>` block that patches `window.WebSocket` to
 * tag `/_bun/*` socket URLs with `?__bundoc_app=<id>`. The `<id>` is derived
 * from `basePath`; if derivation yields an empty string it falls back to
 * `"bundoc"`.
 */
export function buildHmrPatchScript(basePath: string): string {
  const appId = appIdFromBasePath(basePath) || "bundoc";
  const iife = `(function () {
  var O = window.WebSocket;
  function W(url, protocols) {
    var finalUrl = url;
    try {
      var u = new URL(url, location.origin);
      if (u.pathname.indexOf("/_bun/") === 0) {
        u.searchParams.set("__bundoc_app", ${JSON.stringify(appId)});
        finalUrl = u.toString();
      }
    } catch (_) {}
    return new O(finalUrl, protocols);
  }
  W.prototype = O.prototype;
  Object.setPrototypeOf(W, O);
  window.WebSocket = W;
})();`;
  return `<script>${iife}</script>`;
}
