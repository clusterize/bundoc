import { scaffold } from "../scaffold/scaffold.ts";

export async function runInit(opts: { dir: string }) {
  await scaffold(opts.dir);
}
