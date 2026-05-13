import { type SearchHit, useLink, useSearchIndex } from "bundoc/theme";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="hidden h-8 w-full justify-start gap-2 px-3 text-muted-foreground sm:flex sm:w-56 md:w-64"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search docs…</span>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const { query, loading, error } = useSearchIndex();
  const { navigate } = useLink();

  useEffect(() => {
    if (!open) {
      setTerm("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      try {
        const r = await query(term, { limit: 10, tolerance: 1 });
        setHits(r);
      } catch {
        setHits([]);
      }
    }, 80);
    return () => clearTimeout(t);
  }, [term, open, query]);

  const select = (hit: SearchHit) => {
    onOpenChange(false);
    const route = hit.anchor ? `${hit.route}#${hit.anchor}` : hit.route;
    navigate(route);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search docs…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {error ? (
          <div className="px-4 py-6 text-center text-sm text-destructive">
            Failed to load search index.
          </div>
        ) : loading ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading index…
          </div>
        ) : term && hits.length === 0 ? (
          <CommandEmpty>No results for &ldquo;{term}&rdquo;.</CommandEmpty>
        ) : null}

        {hits.length > 0 ? (
          <CommandGroup heading="Results">
            {hits.map((hit, i) => {
              const excerpt = buildExcerpt(hit.text, term);
              return (
                <CommandItem
                  // biome-ignore lint/suspicious/noArrayIndexKey: index disambiguates duplicate route+anchor hits
                  key={`${hit.route}#${hit.anchor}-${i}`}
                  value={`${i}-${hit.route}#${hit.anchor}`}
                  onSelect={() => select(hit)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {hit.heading || hit.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {hit.heading ? `${hit.title} → ` : ""}
                      {hit.route}
                    </span>
                    {excerpt ? (
                      <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {excerpt.map((part, idx) =>
                          part.match ? (
                            <mark
                              // biome-ignore lint/suspicious/noArrayIndexKey: excerpt is a deterministic split, never reordered
                              key={idx}
                              className="rounded bg-yellow-200/60 px-0.5 text-foreground dark:bg-yellow-500/30"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span
                              // biome-ignore lint/suspicious/noArrayIndexKey: excerpt is a deterministic split, never reordered
                              key={idx}
                            >
                              {part.text}
                            </span>
                          ),
                        )}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

type ExcerptPart = { text: string; match: boolean };

/**
 * Build a snippet around the first occurrence of `term` in `text`, with the
 * matched span flagged for highlighting. Returns null when there's nothing
 * useful to show (empty text or empty term).
 */
function buildExcerpt(text: string, term: string): ExcerptPart[] | null {
  const body = (text ?? "").trim();
  if (!body) return null;
  const trimmedTerm = term.trim();
  const WINDOW = 140;

  // No term yet — just show the head of the section.
  if (!trimmedTerm) {
    const head =
      body.length > WINDOW ? `${body.slice(0, WINDOW).trimEnd()}…` : body;
    return [{ text: head, match: false }];
  }

  // Use the longest whitespace-split token for the highlight anchor; Orama
  // tokenises queries, so any token match is a valid hit even if the literal
  // phrase isn't present.
  const tokens = trimmedTerm.split(/\s+/).filter(Boolean);
  const lower = body.toLowerCase();
  let bestIdx = -1;
  let bestLen = 0;
  for (const tok of tokens) {
    const idx = lower.indexOf(tok.toLowerCase());
    if (idx !== -1 && tok.length > bestLen) {
      bestIdx = idx;
      bestLen = tok.length;
    }
  }

  if (bestIdx === -1) {
    const head =
      body.length > WINDOW ? `${body.slice(0, WINDOW).trimEnd()}…` : body;
    return [{ text: head, match: false }];
  }

  const pad = Math.floor((WINDOW - bestLen) / 2);
  const start = Math.max(0, bestIdx - pad);
  const end = Math.min(body.length, bestIdx + bestLen + pad);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  return [
    { text: prefix + body.slice(start, bestIdx), match: false },
    { text: body.slice(bestIdx, bestIdx + bestLen), match: true },
    { text: body.slice(bestIdx + bestLen, end) + suffix, match: false },
  ];
}
