import { Children, isValidElement, type ReactNode } from "react";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/utils";

type PreProps = React.HTMLAttributes<HTMLPreElement> & {
  /** Filename tab — set with ```ts title="x.ts" in MDX. */
  title?: string;
  /** Shiki forwards `data-language` on the wrapping <pre>. */
  "data-language"?: string;
};

function extractText(children: ReactNode): string {
  let out = "";
  Children.forEach(children, (c) => {
    if (typeof c === "string") out += c;
    else if (typeof c === "number") out += String(c);
    else if (isValidElement(c)) {
      // Recurse into children of intermediate spans (Shiki wraps every line).
      const props = c.props as { children?: ReactNode };
      out += extractText(props.children);
    }
  });
  return out;
}

export function Pre({
  children,
  className,
  title,
  "data-language": lang,
  ...rest
}: PreProps) {
  const code = extractText(children);
  return (
    <div className="group relative my-5 overflow-hidden rounded-lg border border-border bg-muted/30">
      {title ? (
        <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-1.5 text-xs">
          <span className="font-mono text-muted-foreground">{title}</span>
          {lang ? (
            <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {lang}
            </span>
          ) : null}
        </div>
      ) : null}
      <pre
        {...rest}
        className={cn(
          "!my-0 overflow-x-auto !rounded-none !border-0 !bg-transparent px-4 py-3 text-sm leading-6",
          className,
        )}
      >
        {children}
      </pre>
      <CopyButton value={code} />
    </div>
  );
}
