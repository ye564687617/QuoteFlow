import { db } from "@/lib/db";
import { processNextExport } from "@/lib/exporter";

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

async function main() {
  console.log("QuoteFlow export worker started");
  while (running) {
    const processed = await processNextExport();
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
