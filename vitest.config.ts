import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { environment: "node", sequence: { concurrent: false }, coverage: { reporter: ["text", "html"] } },
});
