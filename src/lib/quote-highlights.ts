const VOLTAGE_SOURCE = String.raw`DC\s*\d+(?:\.\d+)?\s*V(?:\s*[-/]\s*\d+(?:\.\d+)?\s*V)?`;
const WATTAGE_SOURCE = String.raw`\d+(?:\.\d+)?\s*W(?:\s*\/\s*m)?`;
const voltagePattern = new RegExp(VOLTAGE_SOURCE, "i");
const wattagePattern = new RegExp(WATTAGE_SOURCE, "i");
const specificationPattern = new RegExp(`(${VOLTAGE_SOURCE}|${WATTAGE_SOURCE})`, "gi");
const exactSpecificationPattern = new RegExp(`^(?:${VOLTAGE_SOURCE}|${WATTAGE_SOURCE})$`, "i");

export function splitElectricalSpecs(description: string) {
  const lines = description.split(/(\r?\n)/);
  return lines.flatMap((line) => {
    if (/^\r?\n$/.test(line) || !voltagePattern.test(line) || !wattagePattern.test(line)) {
      return line ? [{ text: line, highlighted: false }] : [];
    }
    return line
      .split(specificationPattern)
      .filter(Boolean)
      .map((text) => ({ text, highlighted: exactSpecificationPattern.test(text) }));
  });
}
