import type {
  PdfCoverProps,
  PdfMarginalProps,
  PdfPageProps,
  PdfTocEntry,
  PdfTocProps,
} from "@clusterize/bundoc/theme";
import "./styles.css";

// PDF handbook theme for `bundoc pdf`. The regular theme entry isn't
// loaded in the print app, so styles are imported here too.

function Mark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block rounded-md ${className}`}
      style={{ background: "var(--color-bundoc)" }}
    />
  );
}

export function PdfCover({ title, generatedAt, locale }: PdfCoverProps) {
  const date = new Date(generatedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="flex h-full flex-col justify-between bg-background p-[20mm] text-foreground">
      <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
        <Mark className="h-5 w-5" />
        bundoc
      </div>
      <div>
        <Mark className="mb-8 h-16 w-16" />
        <h1 className="text-5xl font-bold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Bun-native MDX documentation.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{date}</p>
    </div>
  );
}

export function PdfToc({ entries, locale }: PdfTocProps) {
  return (
    <nav className="text-foreground">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">
        {locale === "de" ? "Inhalt" : "Contents"}
      </h1>
      <TocList entries={entries} />
    </nav>
  );
}

function TocList({ entries }: { entries: PdfTocEntry[] }) {
  return (
    <ul className="space-y-1">
      {entries.map((e) => (
        <li key={e.href} className={e.depth === 0 ? "mt-4" : "pl-5"}>
          <a
            href={e.href}
            className={`flex items-baseline gap-2 break-inside-avoid text-sm no-underline ${e.depth === 0 ? "font-semibold" : ""}`}
          >
            <span>{e.label}</span>
            <span className="flex-1 border-b border-dotted border-muted-foreground/50" />
            <span className="tabular-nums text-muted-foreground">
              {e.pageNumber ?? "000"}
            </span>
          </a>
          {e.children.length > 0 && <TocList entries={e.children} />}
        </li>
      ))}
    </ul>
  );
}

export function PdfPage({ page, children }: PdfPageProps) {
  return (
    <>
      {page.fallback ? (
        <div className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
          No translation for{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            {page.locale}
          </code>{" "}
          — showing the default.
        </div>
      ) : null}
      <article className="bundoc-prose">{children}</article>
    </>
  );
}

export function PdfHeader({ kind, page, title }: PdfMarginalProps) {
  if (kind === "cover") return null;
  return (
    <div className="flex h-full items-end justify-between pb-[7mm] text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        <Mark className="h-3 w-3" />
        {title}
      </span>
      <span>{page ? [...page.breadcrumbs, page.title].join(" › ") : null}</span>
    </div>
  );
}

export function PdfFooter({ kind, pageNumber, totalPages }: PdfMarginalProps) {
  if (kind === "cover") return null;
  return (
    <div className="flex h-full items-start justify-end pt-3 text-xs tabular-nums text-muted-foreground">
      {pageNumber} / {totalPages}
    </div>
  );
}
