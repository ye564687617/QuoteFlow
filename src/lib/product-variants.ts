export type VariantSource = {
  id: string;
  description: string;
  descriptionNormalized: string;
};

export function normalizeDescription(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function extractWattage(description: string) {
  const match = description.match(/\b(\d+(?:\.\d+)?)\s*W\b/i);
  return match ? `${match[1]}W` : null;
}

export function parseRegularPrice(value: string) {
  const normalized = value.trim().replace(/^USD\s*/i, "").replace(/[$,\s]/g, "");
  if (!normalized) return 0;
  const result = Number(normalized);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function normalizedLines(description: string) {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[-–—•]\s*/, ""))
    .filter(Boolean);
}

function differenceLabel(product: VariantSource, group: VariantSource[], wattage: string) {
  const otherLineSets = group
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => new Set(normalizedLines(candidate.description).map(normalizeDescription)));
  const distinct = normalizedLines(product.description).find((line) =>
    otherLineSets.every((lines) => !lines.has(normalizeDescription(line))),
  );
  if (!distinct) return null;
  const withoutWattage = distinct
    .replace(new RegExp(`\\b${wattage.replace(".", "\\.")}\\b`, "i"), "")
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, "")
    .trim();
  const useful = withoutWattage || distinct;
  return useful.length > 42 ? `${useful.slice(0, 39).trim()}...` : useful;
}

export function buildVariantLabels(products: VariantSource[]) {
  const sorted = [...products].sort((a, b) => a.descriptionNormalized.localeCompare(b.descriptionNormalized));
  const baseGroups = new Map<string, VariantSource[]>();
  for (const product of sorted) {
    const base = extractWattage(product.description) ?? "";
    const group = baseGroups.get(base) ?? [];
    group.push(product);
    baseGroups.set(base, group);
  }

  const labels = new Map<string, string>();
  let fallback = 0;
  for (const [base, group] of baseGroups) {
    if (base && group.length === 1) {
      labels.set(group[0].id, base);
      continue;
    }
    for (let index = 0; index < group.length; index += 1) {
      const product = group[index];
      if (!base) {
        fallback += 1;
        labels.set(product.id, `Variant ${fallback}`);
        continue;
      }
      const difference = differenceLabel(product, group, base);
      labels.set(product.id, difference ? `${base} / ${difference}` : `${base} / Variant ${index + 1}`);
    }
  }
  return labels;
}

export async function refreshVariantLabels(tx: Prisma.TransactionClient, pnNormalized: string) {
  const products = await tx.product.findMany({
    where: { pnNormalized },
    select: { id: true, description: true, descriptionNormalized: true },
  });
  const labels = buildVariantLabels(products);
  await Promise.all([...labels].map(([id, variantLabel]) => tx.product.update({ where: { id }, data: { variantLabel } })));
}
import type { Prisma } from "@prisma/client";
