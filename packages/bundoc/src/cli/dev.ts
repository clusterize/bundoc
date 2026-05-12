import { startDevServer } from "../server/dev-server.ts";

export async function runDev(opts: { port: number; host: string }) {
  await startDevServer(opts);
}
