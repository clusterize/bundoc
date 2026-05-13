import { Link, useLocale } from "bundoc/theme";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchTrigger } from "./SearchDialog";
import { ThemeToggle } from "./ThemeToggle";

export function Header({
  onOpenSidebar,
  onOpenSearch,
}: {
  onOpenSidebar: () => void;
  onOpenSearch: () => void;
}) {
  const { locale, locales, setLocale } = useLocale();

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenSidebar}
          aria-label="Open navigation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label="Menu"
          >
            <title>Menu</title>
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </Button>

        <Link
          to="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight hover:no-underline"
        >
          <span
            aria-hidden
            className="inline-block h-5 w-5 rounded-md"
            style={{ background: "var(--color-bundoc)" }}
          />
          <span>bundoc</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <SearchTrigger onClick={onOpenSearch} />
          <div className="hidden sm:flex items-center gap-1">
            {locales.map((l) => (
              <Tooltip key={l}>
                <TooltipTrigger asChild>
                  <Button
                    variant={l === locale ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setLocale(l)}
                  >
                    {l.toUpperCase()}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to {l}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
