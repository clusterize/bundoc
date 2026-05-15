import { expectTypeOf, test } from "bun:test";
import type {
  Heading as ContentHeading,
  NavNode as ContentNavNode,
} from "../content/manifest.ts";
import type {
  Heading as RuntimeHeading,
  NavNode as RuntimeNavNode,
} from "./types.ts";

/**
 * The runtime types in this file are what `bundoc/theme` re-exports to
 * theme authors. The content-side types in `content/manifest.ts` are
 * what bundoc uses internally to build the manifest. These two
 * declarations are mirrored by hand — drift between them is the source
 * of the v0.2.0 `NavNode.meta` bug (public type lacked the field while
 * the runtime data carried it, breaking theme typecheck).
 *
 * If you change either declaration, these assertions will fail at
 * type-check time until you sync the other side.
 */
test("runtime/content NavNode shapes match", () => {
  expectTypeOf<RuntimeNavNode>().toEqualTypeOf<ContentNavNode>();
});

test("runtime/content Heading shapes match", () => {
  expectTypeOf<RuntimeHeading>().toEqualTypeOf<ContentHeading>();
});
