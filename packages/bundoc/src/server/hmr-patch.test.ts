import { expect, test } from "bun:test";
import { appIdFromBasePath, buildHmrPatchScript } from "./hmr-patch.ts";

test("appIdFromBasePath: simple path", () => {
  expect(appIdFromBasePath("/docs")).toBe("docs");
});

test("appIdFromBasePath: root → empty string", () => {
  expect(appIdFromBasePath("/")).toBe("");
});

test("appIdFromBasePath: spaces and trailing slash normalise", () => {
  expect(appIdFromBasePath("/Foo Bar/")).toBe("foo-bar");
});

test("appIdFromBasePath: nested path collapses separators", () => {
  expect(appIdFromBasePath("/team/internal-docs")).toBe("team-internal-docs");
});

test("buildHmrPatchScript: wraps the IIFE and embeds the app id", () => {
  const script = buildHmrPatchScript("/docs");
  expect(script.startsWith("<script>")).toBe(true);
  expect(script.endsWith("</script>")).toBe(true);
  expect(script).toContain("window.WebSocket");
  expect(script).toContain('"__bundoc_app", "docs"');
});

test("buildHmrPatchScript: empty-derived id falls back to bundoc", () => {
  const script = buildHmrPatchScript("/");
  expect(script).toContain('"__bundoc_app", "bundoc"');
});
