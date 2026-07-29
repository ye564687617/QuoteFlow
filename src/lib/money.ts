import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function lineAmount(quantity: Decimal.Value, unitPrice: Decimal.Value) {
  return new Decimal(quantity).mul(unitPrice).toDecimalPlaces(2);
}

export function quoteTotals(items: Array<{ quantity: Decimal.Value; unitPrice: Decimal.Value }>, shippingFee: Decimal.Value) {
  const subtotal = items.reduce((sum, item) => sum.plus(lineAmount(item.quantity, item.unitPrice)), new Decimal(0));
  return { subtotal, total: subtotal.plus(shippingFee).toDecimalPlaces(2) };
}

export function money(value: Decimal.Value) {
  return new Decimal(value).toFixed(2);
}
