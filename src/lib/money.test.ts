import { describe, expect, it } from "vitest";
import { lineAmount, quoteTotals } from "@/lib/money";

describe("quote money", () => {
  it("rounds each line to cents using commercial rounding", () => {
    expect(lineAmount("3", "0.335").toFixed(2)).toBe("1.01");
  });

  it("adds shipping to the subtotal without floating point drift", () => {
    const totals = quoteTotals([{ quantity: "3", unitPrice: "0.1" }, { quantity: "7", unitPrice: "0.2" }], "12.45");
    expect(totals.subtotal.toFixed(2)).toBe("1.70");
    expect(totals.total.toFixed(2)).toBe("14.15");
  });
});
