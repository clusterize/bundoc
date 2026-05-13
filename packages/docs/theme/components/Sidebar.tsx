import { Link, type NavNode } from "@clusterize/bundoc/theme";
import { cn } from "@/lib/utils";

export function Sidebar({
  nodes,
  currentRoute,
  onNavigate,
}: {
  nodes: NavNode[];
  currentRoute: string;
  onNavigate?: () => void;
}) {
  if (!nodes.length) return null;
  return (
    <nav aria-label="Sidebar" className="text-sm">
      <ul className="space-y-1">
        {nodes.map((n) => (
          <NavEntry
            key={n.route ?? n.label}
            node={n}
            currentRoute={currentRoute}
            depth={0}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavEntry({
  node,
  currentRoute,
  depth,
  onNavigate,
}: {
  node: NavNode;
  currentRoute: string;
  depth: number;
  onNavigate?: () => void;
}) {
  const leafRoute = node.route;
  const isActive = leafRoute === currentRoute;

  return (
    <li>
      {leafRoute ? (
        <Link
          to={leafRoute}
          onClick={onNavigate}
          className={cn(
            "relative block rounded-md px-2 py-1 transition-colors hover:no-underline",
            isActive
              ? "bg-accent font-semibold text-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          {isActive ? (
            <span
              aria-hidden
              className="absolute -left-px top-1.5 bottom-1.5 w-px rounded-full"
              style={{ background: "var(--color-bundoc)" }}
            />
          ) : null}
          {node.label}
        </Link>
      ) : (
        <span
          className={cn(
            "block py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
            depth === 0 ? "mt-4 first:mt-0" : "mt-2",
          )}
        >
          {node.label}
        </span>
      )}
      {node.children.length > 0 ? (
        <ul
          className={cn(
            "space-y-1",
            depth === 0 ? "" : "border-l border-border pl-2",
          )}
        >
          {node.children.map((c) => (
            <NavEntry
              key={c.route ?? c.label}
              node={c}
              currentRoute={currentRoute}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
