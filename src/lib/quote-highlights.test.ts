import { describe, expect, it } from "vitest";
import { splitElectricalSpecs } from "@/lib/quote-highlights";

describe("quote description highlights", () => {
  it("highlights voltage and wattage values independently", () => {
    expect(splitElectricalSpecs("- DMX512IC, DC24V ,4.32W\n- waterproof connector")).toEqual([
      { text: "- DMX512IC, ", highlighted: false },
      { text: "DC24V", highlighted: true },
      { text: " ,", highlighted: false },
      { text: "4.32W", highlighted: true },
      { text: "\n", highlighted: false },
      { text: "- waterproof connector", highlighted: false },
    ]);
  });

  it("supports voltage ranges, lowercase units and wattage-first descriptions", () => {
    expect(splitElectricalSpecs("DC24V-48v, 0.96W / 600W, DC12V").filter((part) => part.highlighted).map((part) => part.text)).toEqual([
      "DC24V-48v",
      "0.96W",
      "600W",
      "DC12V",
    ]);
  });

  it("does not highlight an isolated voltage or wattage", () => {
    expect(splitElectricalSpecs("Power supply 600W\nInput DC12V").some((part) => part.highlighted)).toBe(false);
  });
});
