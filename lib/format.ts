import { BASE_CURRENCY } from "@/lib/constants";
import type { Currency } from "@/types/finance";

const formatters = new Map<Currency, Intl.NumberFormat>();

export function formatCurrency(
  amount: number,
  currency: Currency = BASE_CURRENCY,
) {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
}
