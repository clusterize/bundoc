import { useTOC } from "@clusterize/bundoc/theme";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function TOC() {
  const headings = useTOC().filter((h) => h.level >= 2 && h.level <= 3);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) {
          setActive(visible.target.id);
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0,
      },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1 border-l border-border">
        {headings.map((h) => {
          const isActive = h.id === active;
          return (
            <li
              key={h.id}
              className={cn(
                "transition-colors",
                h.level === 3 ? "pl-5" : "pl-3",
              )}
            >
              <a
                href={`#${h.id}`}
                className={cn(
                  "relative inline-flex items-center gap-1 py-0.5 transition-colors",
                  isActive
                    ? "font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
                style={isActive ? { color: "var(--color-bundoc)" } : undefined}
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className="absolute -left-1 h-1 w-1 rounded-full"
                    style={{
                      background: "var(--color-bundoc)",
                      left: h.level === 3 ? "-1.4rem" : "-0.85rem",
                    }}
                  />
                ) : null}
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
