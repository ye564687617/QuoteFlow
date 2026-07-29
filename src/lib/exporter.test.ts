import { describe, expect, it } from "vitest";
import { sanitizeExportError } from "@/lib/exporter";

describe("sanitizeExportError", () => {
  it("redacts render tokens from browser errors", () => {
    const message = 'page.goto failed at http://app:3000/render/quotes/1?token=secret-value Call log: navigating to "http://app:3000/render/quotes/1?token=secret-value"';
    expect(sanitizeExportError(message)).toBe('page.goto failed at http://app:3000/render/quotes/1?token=[REDACTED] Call log: navigating to "http://app:3000/render/quotes/1?token=[REDACTED]"');
  });
});
