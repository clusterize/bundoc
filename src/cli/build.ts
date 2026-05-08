import { runBuild as doBuild } from "../server/build.ts";

export async function runBuild(opts: { out: string }) {
  await doBuild(opts);
}
