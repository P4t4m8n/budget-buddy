import type { Investment } from "@/types/finance";

export const investments: Investment[] = [
  { id: "i-001", name: "S&P 500 ETF", type: "ETF", ticker: "VOO", amountInvested: 8000, currentValue: 9150, currency: "ILS", purchaseDate: "2025-03-10" },
  { id: "i-002", name: "World Index ETF", type: "ETF", ticker: "VWRL", amountInvested: 5000, currentValue: 5420, currency: "ILS", purchaseDate: "2025-09-15" },
  { id: "i-003", name: "Apple", type: "STOCK", ticker: "AAPL", amountInvested: 2000, currentValue: 2480, currency: "ILS", purchaseDate: "2024-11-05" },
  { id: "i-004", name: "Bitcoin", type: "CRYPTO", ticker: "BTC", amountInvested: 1500, currentValue: 1320, currency: "ILS", purchaseDate: "2026-01-20" },
  { id: "i-005", name: "Government bonds", type: "BOND", ticker: null, amountInvested: 3000, currentValue: 3090, currency: "ILS", purchaseDate: "2026-02-01" },
];
