import { useEffect, useState } from "react";
import {
  PageOutlet,
  Link,
  useNav,
  useLocale,
  useCurrentPage,
} from "bundoc/theme";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { TOC } from "./components/TOC";
import { PrevNext } from "./components/PrevNext";
import { SearchDialog } from "./components/SearchDialog";
import "./styles.css";

export default function ThemeApp() {
  const nav = useNav();
  const { locale } = useLocale();
  const page = useCurrentPage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ⌘K opens the search palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />

        <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-8 px-4 py-8 lg:grid-cols-[16rem_minmax(0,1fr)_14rem] lg:gap-10 lg:px-6">
          <aside className="hidden lg:block">
            <ScrollArea className="sticky top-20 max-h-[calc(100vh-6rem)] pr-4">
              <Sidebar
                nodes={nav.tree.children}
                currentRoute={nav.currentPath}
              />
            </ScrollArea>
          </aside>

          <main className="min-w-0">
            {page.fallback ? (
              <div
                role="status"
                className="mb-6 rounded-md border border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
              >
                No translation for{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {locale}
                </code>{" "}
                — showing the default.
              </div>
            ) : null}

            <article
              key={`${nav.currentPath}-${locale}`}
              className="bundoc-prose max-w-3xl page-fade"
            >
              <PageOutlet
                fallback={
                  <p className="text-muted-foreground">Loading…</p>
                }
                notFound={
                  <div className="space-y-4">
                    <h1>404</h1>
                    <p className="text-muted-foreground">
                      The page you&rsquo;re looking for doesn&rsquo;t exist.
                    </p>
                    <Link to="/">Go home</Link>
                  </div>
                }
              />
            </article>
            <div className="max-w-3xl">
              <PrevNext prev={nav.prev} next={nav.next} />
            </div>
          </main>

          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <TOC />
            </div>
          </aside>
        </div>

        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-72">
            <SheetTitle>Navigation</SheetTitle>
            <ScrollArea className="mt-4 h-[calc(100vh-6rem)] pr-3">
              <Sidebar
                nodes={nav.tree.children}
                currentRoute={nav.currentPath}
                onNavigate={() => setSidebarOpen(false)}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </TooltipProvider>
  );
}
