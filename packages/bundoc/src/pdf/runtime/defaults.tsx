import type { CSSProperties } from "react";
import type {
  PdfCoverProps,
  PdfMarginalProps,
  PdfPageProps,
  PdfTocEntry,
  PdfTocProps,
} from "../../theme/pdf.ts";

// Built-in PDF components. Deliberately plain (inline styles, system
// fonts) so they work with any theme CSS; themes replace them by
// exporting components of the same name from `theme/pdf.tsx`.

const TOC_HEADINGS: Record<string, string> = {
  de: "Inhalt",
  en: "Contents",
  es: "Contenido",
  fr: "Sommaire",
  it: "Indice",
  nl: "Inhoud",
};

const muted: CSSProperties = { color: "#6b7280" };

export function DefaultPdfCover({ title, generatedAt, locale }: PdfCoverProps) {
  const date = new Date(generatedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return (
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 20mm",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "32pt", margin: 0 }}>{title}</h1>
      <p style={{ ...muted, fontSize: "12pt", marginTop: "6mm" }}>{date}</p>
    </div>
  );
}

export function DefaultPdfToc({ entries, locale }: PdfTocProps) {
  return (
    <nav style={{ fontFamily: "system-ui, sans-serif", fontSize: "10.5pt" }}>
      <h1 style={{ fontSize: "20pt", margin: "0 0 8mm" }}>
        {TOC_HEADINGS[locale.split("-")[0] ?? ""] ?? TOC_HEADINGS.en}
      </h1>
      <TocList entries={entries} />
    </nav>
  );
}

function TocList({ entries }: { entries: PdfTocEntry[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {entries.map((e) => (
        <li
          key={e.href}
          style={{
            paddingLeft: e.depth > 0 ? "5mm" : 0,
            marginTop: e.depth === 0 ? "3mm" : "1mm",
          }}
        >
          <a
            href={e.href}
            style={{
              display: "flex",
              gap: "2mm",
              color: "inherit",
              textDecoration: "none",
              fontWeight: e.depth === 0 ? 600 : 400,
              breakInside: "avoid",
            }}
          >
            <span>{e.label}</span>
            <span
              style={{
                flex: 1,
                borderBottom: "1px dotted #9ca3af",
                marginBottom: "1.2mm",
              }}
            />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {e.pageNumber ?? "000"}
            </span>
          </a>
          {e.children.length > 0 && <TocList entries={e.children} />}
        </li>
      ))}
    </ul>
  );
}

export function DefaultPdfPage({ children }: PdfPageProps) {
  return <article>{children}</article>;
}

const marginal: CSSProperties = {
  height: "100%",
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "space-between",
  gap: "6mm",
  fontFamily: "system-ui, sans-serif",
  fontSize: "8.5pt",
  color: "#6b7280",
};

export function DefaultPdfHeader({ kind, page, title }: PdfMarginalProps) {
  if (kind === "cover") return null;
  return (
    <div style={{ ...marginal, alignItems: "flex-end", paddingBottom: "5mm" }}>
      <span>{page?.breadcrumbs[0] ?? title}</span>
      <span>{page?.title ?? ""}</span>
    </div>
  );
}

export function DefaultPdfFooter({
  kind,
  title,
  pageNumber,
  totalPages,
}: PdfMarginalProps) {
  if (kind === "cover") return null;
  return (
    <div style={{ ...marginal, alignItems: "flex-start", paddingTop: "5mm" }}>
      <span>{title}</span>
      <span>
        {pageNumber} / {totalPages}
      </span>
    </div>
  );
}
