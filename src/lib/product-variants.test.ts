import { describe, expect, it } from "vitest";
import { buildVariantLabels, normalizeDescription } from "@/lib/product-variants";

describe("product variants", () => {
  it("uses the wattage for distinct power variants", () => {
    const labels = buildVariantLabels([
      { id: "low", description: "UCS2904, DC12V, 0.96W", descriptionNormalized: normalizeDescription("UCS2904, DC12V, 0.96W") },
      { id: "high", description: "UCS2904, DC12V, 1.4W", descriptionNormalized: normalizeDescription("UCS2904, DC12V, 1.4W") },
    ]);
    expect(labels.get("low")).toBe("0.96W");
    expect(labels.get("high")).toBe("1.4W");
  });

  it("adds a description fragment when the wattage repeats", () => {
    const labels = buildVariantLabels([
      { id: "one", description: "UCS2904, DC12V, 0.96W\n- 1 light separate", descriptionNormalized: normalizeDescription("UCS2904, DC12V, 0.96W\n- 1 light separate") },
      { id: "many", description: "UCS2904, DC12V, 0.96W\n- 5-20 lights separate", descriptionNormalized: normalizeDescription("UCS2904, DC12V, 0.96W\n- 5-20 lights separate") },
    ]);
    expect(labels.get("one")).toBe("0.96W / 1 light separate");
    expect(labels.get("many")).toBe("0.96W / 5-20 lights separate");
  });
});
