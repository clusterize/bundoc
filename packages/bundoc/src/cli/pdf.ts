import { loadConfig } from "../config/index.ts";
import { generatePdfs } from "../pdf/generate.ts";

export async function runPdf(opts: { out: string; locales?: string[] }) {
  const config = await loadConfig();
  await generatePdfs({ config, ...opts });
}
