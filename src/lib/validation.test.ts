import { describe, expect, it } from "vitest";
import { quoteDraftSchema } from "@/lib/validation";

function item(productId: string | null, pnSnapshot: string) {
  return {
    productId,
    pnSnapshot,
    descriptionSnapshot: "Test product",
    unitSnapshot: "pcs",
    imagePathSnapshot: null,
    quantity: 1,
    unitPrice: 1,
  };
}

describe("quote draft validation", () => {
  it("rejects the same product more than once", () => {
    const result = quoteDraftSchema.safeParse({
      shippingFee: 0,
      items: [item("product-1", "SJ-1"), item("product-1", "SJ-1")],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("同一产品不能重复添加");
  });

  it("uses normalized P/N when an item has no product id", () => {
    const result = quoteDraftSchema.safeParse({
      shippingFee: 0,
      items: [item(null, "SJ-2"), item(null, " sj-2 ")],
    });
    expect(result.success).toBe(false);
  });
});
