import { useEffect, useState } from "react";
import { useSearchIndex, useLink, type SearchHit } from "bundoc/theme";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
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
            {hits.map((hit, i) => (
              <CommandItem
                key={`${hit.route}#${hit.anchor}-${i}`}
                value={`${hit.route}#${hit.anchor}-${i}-${hit.heading || hit.title}`}
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
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
