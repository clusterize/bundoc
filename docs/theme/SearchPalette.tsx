import { useEffect, useRef, useState } from "react";
import { useSearchIndex, useLink, type SearchHit } from "bundoc/theme";

/**
 * ⌘K command palette. Opens on Cmd/Ctrl+K, closes on Escape, navigates
 * via the locale-aware Link helper.
 */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, loading, error } = useSearchIndex();
  const { navigate } = useLink();

  // Cmd/Ctrl+K to open; Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input when the palette opens.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setTerm("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  // Run the query (debounced).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const r = await query(term, { limit: 8, tolerance: 1 });
        setHits(r);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 80);
    return () => clearTimeout(t);
  }, [term, open, query]);

  const select = (hit: SearchHit) => {
    setOpen(false);
    const route = hit.anchor ? `${hit.route}#${hit.anchor}` : hit.route;
    navigate(route);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <span>Search…</span>
        <kbd className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-[10vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search…"
          className="w-full px-4 py-3 bg-transparent border-b border-zinc-200 dark:border-zinc-800 outline-none text-base"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              select(hits[active]);
            }
          }}
        />
        <div className="max-h-[60vh] overflow-y-auto">
          {error ? (
            <p className="px-4 py-3 text-sm text-red-600">Failed to load search index.</p>
          ) : loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Loading…</p>
          ) : term && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">No results.</p>
          ) : (
            <ul>
              {hits.map((hit, i) => (
                <li key={`${hit.route}#${hit.anchor}-${i}`}>
                  <button
                    type="button"
                    onClick={() => select(hit)}
                    onMouseEnter={() => setActive(i)}
                    className={
                      "w-full text-left px-4 py-2 flex flex-col gap-0.5 " +
                      (i === active
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-900")
                    }
                  >
                    <span className="text-sm font-medium">
                      {hit.heading || hit.title}
                    </span>
                    {hit.heading ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {hit.title} → {hit.route}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {hit.route}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
