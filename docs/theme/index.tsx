import {
  PageOutlet,
  Link,
  useNav,
  useLocale,
  useCurrentPage,
  useTOC,
  type NavNode,
} from "bundoc/theme";
import { SearchPalette } from "./SearchPalette.tsx";
import "./styles.css";

export default function ThemeApp() {
  const nav = useNav();
  const { locale, locales, setLocale } = useLocale();
  const page = useCurrentPage();
  const toc = useTOC();

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
      <header className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <Link to="/" className="font-bold text-lg text-blue-600 dark:text-blue-400 hover:no-underline">
          bundoc
        </Link>
        <div className="flex items-center gap-3">
          <SearchPalette />
        <div className="flex gap-1">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              className={
                "px-2.5 py-1 rounded-md border text-sm cursor-pointer transition-colors " +
                (l === locale
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900")
              }
              onClick={() => setLocale(l)}
            >
              {l}
            </button>
          ))}
        </div>
        </div>
      </header>

      <div className="grid gap-6 px-6 py-6 w-full max-w-6xl mx-auto flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_220px]">
        <aside className="text-[0.95rem]">
          <Sidebar nodes={nav.tree.children} currentRoute={nav.currentPath} />
        </aside>

        <main className="min-w-0">
          {page.fallback ? (
            <div className="mb-4 px-3 py-2 rounded-md text-sm bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
              No translation for <code className="font-mono">{locale}</code> — showing the default.
            </div>
          ) : null}
          <article className="bundoc-prose">
            <PageOutlet
              fallback={<p>Loading…</p>}
              notFound={
                <div>
                  <h1>404</h1>
                  <p>Not found.</p>
                  <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
                    Go home
                  </Link>
                </div>
              }
            />
          </article>
          <PrevNext prev={nav.prev} next={nav.next} />
        </main>

        {toc.length > 0 ? (
          <aside className="hidden lg:block text-sm">
            <strong className="block mb-2 text-zinc-500 dark:text-zinc-400 uppercase tracking-wide text-xs">
              On this page
            </strong>
            <ul className="border-l border-zinc-200 dark:border-zinc-800">
              {toc
                .filter((h) => h.level >= 2 && h.level <= 3)
                .map((h) => (
                  <li
                    key={h.id}
                    className={
                      h.level === 3 ? "pl-5 py-0.5 text-xs" : "pl-2 py-0.5"
                    }
                  >
                    <a
                      href={`#${h.id}`}
                      className="text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Sidebar({ nodes, currentRoute }: { nodes: NavNode[]; currentRoute: string }) {
  if (!nodes.length) return null;
  return (
    <ul className="list-none p-0 m-0">
      {nodes.map((n, i) => (
        <NavEntry key={i} node={n} currentRoute={currentRoute} />
      ))}
    </ul>
  );
}

function NavEntry({ node, currentRoute }: { node: NavNode; currentRoute: string }) {
  const isLeaf = !!node.route;
  const isActive = node.route === currentRoute;
  return (
    <li className="my-0.5">
      {isLeaf ? (
        <Link
          to={node.route!}
          className={
            "block px-2 py-0.5 rounded " +
            (isActive
              ? "text-blue-600 dark:text-blue-400 bg-zinc-100 dark:bg-zinc-900 font-semibold"
              : "text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:no-underline")
          }
        >
          {node.label}
        </Link>
      ) : (
        <span className="block font-semibold text-zinc-500 dark:text-zinc-400 text-xs uppercase tracking-wide px-2 py-1">
          {node.label}
        </span>
      )}
      {node.children.length > 0 ? (
        <ul className="list-none pl-3 my-1 border-l border-zinc-200 dark:border-zinc-800">
          {node.children.map((c, i) => (
            <NavEntry key={i} node={c} currentRoute={currentRoute} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PrevNext({
  prev,
  next,
}: {
  prev: { route: string; title: string } | null;
  next: { route: string; title: string } | null;
}) {
  if (!prev && !next) return null;
  return (
    <nav className="flex justify-between mt-10 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-sm">
      {prev ? (
        <Link to={prev.route} className="text-blue-600 dark:text-blue-400 hover:underline">
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.route} className="text-blue-600 dark:text-blue-400 hover:underline">
          {next.title} →
        </Link>
      ) : null}
    </nav>
  );
}
