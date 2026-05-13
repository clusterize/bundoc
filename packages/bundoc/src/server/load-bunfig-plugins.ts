import { join } from "node:path";
import type { BunPlugin } from "bun";

/**
 * Read `bunfig.toml` from `rootDir` and load any plugins declared under
 * `[serve.static].plugins` or `[bundle].plugins`. Returns the loaded
 * `BunPlugin` instances ready to pass to `Bun.build({ plugins })`.
 *
 * `Bun.serve` reads bunfig automatically; `Bun.build` does not. This bridges
 * the gap so themes that wire Tailwind/etc. via `[serve.static]` work in
 * `bundoc build` too.
 */
export async function loadBunfigPlugins(rootDir: string): Promise<BunPlugin[]> {
  const bunfigPath = join(rootDir, "bunfig.toml");
  if (!(await Bun.file(bunfigPath).exists())) return [];

  let bunfig: {
    serve?: { static?: { plugins?: string[] } };
    bundle?: { plugins?: string[] };
  };
  try {
    // Bun supports importing `.toml` directly.
    const mod = (await import(bunfigPath)) as { default?: typeof bunfig };
    bunfig = mod.default ?? (mod as unknown as typeof bunfig);
  } catch (err) {
    console.warn(`[bundoc] could not parse ${bunfigPath}:`, err);
    return [];
  }

  const names = [
    ...(bunfig.serve?.static?.plugins ?? []),
    ...(bunfig.bundle?.plugins ?? []),
  ];
  if (!names.length) return [];

  // Resolve from the project root so plugin packages are picked up from the
  // consumer's node_modules.
  const out: BunPlugin[] = [];
  for (const name of names) {
    try {
      const resolved = Bun.resolveSync(name, rootDir);
      const mod = await import(resolved);
      const plugin = mod.default ?? mod;
      // Some plugins export a factory; call it if it's a function.
      const instance = typeof plugin === "function" ? plugin() : plugin;
      if (
        instance &&
        typeof instance === "object" &&
        "name" in instance &&
        "setup" in instance
      ) {
        out.push(instance as BunPlugin);
      } else {
        console.warn(
          `[bundoc] "${name}" did not export a BunPlugin (got ${typeof plugin})`,
        );
      }
    } catch (err) {
      console.warn(`[bundoc] failed to load bunfig plugin "${name}":`, err);
    }
  }
  return out;
}
