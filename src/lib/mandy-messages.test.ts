import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { isMandy, MANDY_COMPLETION_MESSAGES, MANDY_WARM_MESSAGES, pickMandyMessage } from "@/lib/mandy-messages";

describe("Mandy Easter egg messages", () => {
  it("contains exactly 100 unique messages in each collection", () => {
    expect(MANDY_COMPLETION_MESSAGES).toHaveLength(100);
    expect(new Set(MANDY_COMPLETION_MESSAGES)).toHaveProperty("size", 100);
    expect(MANDY_WARM_MESSAGES).toHaveLength(100);
    expect(new Set(MANDY_WARM_MESSAGES)).toHaveProperty("size", 100);
  });

  it("only enables the Easter egg for Mandy", () => {
    expect(isMandy({ email: "sales@example.com", piPrefix: "Mandy" })).toBe(true);
    expect(isMandy({ email: "Mandy@QuoteFlow.Local", piPrefix: "OTHER" })).toBe(true);
    expect(isMandy({ email: "sales@example.com", piPrefix: "ALICE" })).toBe(false);
  });

  it("selects the same message for the same seed", () => {
    const seed = `Mandy-quote-${UserRole.SALESPERSON}`;
    expect(pickMandyMessage(MANDY_WARM_MESSAGES, seed)).toBe(pickMandyMessage(MANDY_WARM_MESSAGES, seed));
  });
});
