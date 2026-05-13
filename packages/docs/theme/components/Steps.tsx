import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Steps({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <ol className="!my-6 !list-none !p-0 space-y-6">
      {items.map((child, i) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: MDX children are static; order never changes after render
          key={i}
          className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-4 pl-0"
        >
          <span
            aria-hidden
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground",
            )}
          >
            {i + 1}
          </span>
          <div className="min-w-0 [&>:first-child]:mt-0">{child}</div>
        </li>
      ))}
    </ol>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
