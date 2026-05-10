import { Link } from "bundoc/theme";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = { route: string; title: string } | null;

export function PrevNext({ prev, next }: { prev: Item; next: Item }) {
  if (!prev && !next) return null;
  return (
    <nav className="mt-12 grid gap-4 sm:grid-cols-2">
      {prev ? (
        <Link
          to={prev.route}
          className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-all hover:border-foreground/20 hover:shadow-sm hover:no-underline"
        >
          <span className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            <ChevronLeft className="h-3 w-3" />
            Previous
          </span>
          <span className="font-medium text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={next.route}
          className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-right transition-all hover:border-foreground/20 hover:shadow-sm sm:col-start-2 hover:no-underline"
        >
          <span className="flex items-center justify-end gap-1 text-xs uppercase tracking-wider text-muted-foreground">
            Next
            <ChevronRight className="h-3 w-3" />
          </span>
          <span className="font-medium text-foreground">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
