#!/usr/bin/env bun
/**
 * bundoc CLI dispatch.
 */

const HELP = `bundoc — Bun-native MDX docs

Usage: bundoc <command> [options]

Commands:
  dev       Start dev server with HMR
  build     Build a static site to dist/
  preview   Serve a previously built dist/
  init      Scaffold a new bundoc site

Options:
  -h, --help     Show this help
  -v, --version  Show version
`;

type Argv = {
  cmd: string | undefined;
  flags: Record<string, string | boolean>;
  positional: string[];
};

function parseArgv(argv: string[]): Argv {
  let cmd: string | undefined;
  const rest: string[] = [];
  for (const a of argv) {
    if (cmd === undefined && !a.startsWith("-")) {
      cmd = a;
    } else {
      rest.push(a);
    }
  }
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next && !next.startsWith("-")) {
          flags[a.slice(2)] = next;
          i++;
        } else {
          flags[a.slice(2)] = true;
        }
      }
    } else if (a.startsWith("-")) {
      flags[a.slice(1)] = true;
    } else {
      positional.push(a);
    }
  }
  return { cmd, flags, positional };
}

async function main() {
  const { cmd, flags, positional } = parseArgv(process.argv.slice(2));

  if (flags.help || flags.h || cmd === "help" || cmd === undefined) {
    console.log(HELP);
    return;
  }
  if (flags.version || flags.v) {
    const pkg = await Bun.file(
      new URL("../../package.json", import.meta.url),
    ).json();
    console.log(pkg.version);
    return;
  }

  switch (cmd) {
    case "dev": {
      const { runDev } = await import("./dev.ts");
      await runDev({
        port: typeof flags.port === "string" ? Number(flags.port) : 3000,
        host: typeof flags.host === "string" ? flags.host : "localhost",
      });
      return;
    }
    case "build": {
      const { runBuild } = await import("./build.ts");
      await runBuild({
        out: typeof flags.out === "string" ? flags.out : "dist",
      });
      return;
    }
    case "preview": {
      const { runPreview } = await import("./preview.ts");
      await runPreview({
        out: typeof flags.out === "string" ? flags.out : "dist",
        port: typeof flags.port === "string" ? Number(flags.port) : 4173,
        host: typeof flags.host === "string" ? flags.host : "localhost",
      });
      return;
    }
    case "init": {
      const { runInit } = await import("./init.ts");
      await runInit({ dir: positional[0] ?? "." });
      return;
    }
    default: {
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
