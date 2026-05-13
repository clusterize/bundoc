import { AlertOctagon, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CalloutType = "info" | "warn" | "danger" | "tip";

const STYLES: Record<
  CalloutType,
  { bg: string; border: string; icon: typeof Info }
> = {
  info: {
    bg: "bg-blue-50/80 dark:bg-blue-950/40",
    border: "border-blue-300 dark:border-blue-800",
    icon: Info,
  },
  tip: {
    bg: "bg-emerald-50/80 dark:bg-emerald-950/40",
    border: "border-emerald-300 dark:border-emerald-800",
    icon: Lightbulb,
  },
  warn: {
    bg: "bg-amber-50/80 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
    icon: AlertTriangle,
  },
  danger: {
    bg: "bg-red-50/80 dark:bg-red-950/40",
    border: "border-red-300 dark:border-red-800",
    icon: AlertOctagon,
  },
};

export function Callout({
  type = "info",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}) {
  const style = STYLES[type];
  const Icon = style.icon;
  return (
    <div
      className={cn(
        "my-5 flex gap-3 rounded-lg border px-4 py-3",
        style.bg,
        style.border,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {title ? (
          <p className="!my-0 mb-1 font-semibold text-foreground">{title}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
