import {
  PageOutlet,
  Link,
  useNav,
  useLocale,
  useCurrentPage,
  useTOC,
  type NavNode,
} from "bundoc/theme";
import "./styles.css";

export default function ThemeApp() {
  const nav = useNav();
  const { locale, locales, setLocale } = useLocale();
  const page = useCurrentPage();
  const toc = useTOC();

  return (
    <div className="bundoc-layout">
      <header className="bundoc-header">
        <Link to="/" className="bundoc-brand">
          bundoc
        </Link>
        <div className="bundoc-locale-switcher">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              className={l === locale ? "active" : ""}
              onClick={() => setLocale(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </header>
      <div className="bundoc-body">
        <aside className="bundoc-sidebar">
          <Sidebar nodes={nav.tree.children} currentRoute={nav.currentPath} />
        </aside>
        <main className="bundoc-main">
          {page.fallback ? (
            <div className="bundoc-fallback-banner">
              No translation for <code>{locale}</code> — showing the default.
            </div>
          ) : null}
          <article className="bundoc-article">
            <PageOutlet
              fallback={<p>Loading…</p>}
              notFound={
                <div>
                  <h1>404</h1>
                  <p>Not found.</p>
                  <Link to="/">Go home</Link>
                </div>
              }
            />
          </article>
          <PrevNext prev={nav.prev} next={nav.next} />
        </main>
        {toc.length > 0 ? (
          <aside className="bundoc-toc">
            <strong>On this page</strong>
            <ul>
              {toc
                .filter((h) => h.level >= 2 && h.level <= 3)
                .map((h) => (
                  <li key={h.id} data-level={h.level}>
                    <a href={`#${h.id}`}>{h.text}</a>
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
    <ul className="bundoc-nav">
      {nodes.map((n, i) => (
        <NavEntry key={i} node={n} currentRoute={currentRoute} />
      ))}
    </ul>
  );
}

function NavEntry({ node, currentRoute }: { node: NavNode; currentRoute: string }) {
  const isLeaf = !!node.route;
  return (
    <li className={isLeaf ? "leaf" : "category"}>
      {isLeaf ? (
        <Link
          to={node.route!}
          className={node.route === currentRoute ? "active" : undefined}
        >
          {node.label}
        </Link>
      ) : (
        <span className="category-label">{node.label}</span>
      )}
      {node.children.length > 0 ? (
        <Sidebar nodes={node.children} currentRoute={currentRoute} />
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
    <nav className="bundoc-prevnext">
      {prev ? (
        <Link to={prev.route} className="prev">
          ← {prev.title}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link to={next.route} className="next">
          {next.title} →
        </Link>
      ) : null}
    </nav>
  );
}
