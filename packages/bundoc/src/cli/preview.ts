import { startPreviewServer } from "../server/preview.ts";

export async function runPreview(opts: {
  out: string;
  port: number;
  host: string;
}) {
  await startPreviewServer(opts);
}
