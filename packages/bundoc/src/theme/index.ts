// Public theme API. Themes import from `bundoc/theme`.

export { PageOutlet } from "../runtime/outlet.tsx";
export type { Heading, ManifestRouteEntry, NavNode } from "../runtime/types.ts";
export type {
  CurrentPage,
  UseLink,
  UseLocaleResult,
  UseNavResult,
} from "./hooks.ts";
export {
  useCurrentPage,
  useFrontmatter,
  useLink,
  useLocale,
  useNav,
  useTOC,
} from "./hooks.ts";
export type { LinkProps } from "./Link.tsx";
export { Link } from "./Link.tsx";
export type { SearchClient, SearchHit } from "./search.ts";
export { useSearchIndex } from "./search.ts";
