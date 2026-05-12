// Public theme API. Themes import from `bundoc/theme`.
export {
  useLocale,
  useNav,
  useTOC,
  useCurrentPage,
  useFrontmatter,
  useLink,
} from "./hooks.ts";
export type {
  UseLocaleResult,
  UseNavResult,
  CurrentPage,
  UseLink,
} from "./hooks.ts";
export { useSearchIndex } from "./search.ts";
export type { SearchHit, SearchClient } from "./search.ts";
export { Link } from "./Link.tsx";
export type { LinkProps } from "./Link.tsx";
export { PageOutlet } from "../runtime/outlet.tsx";
export type { NavNode, Heading, ManifestRouteEntry } from "../runtime/types.ts";
