export type TransactionType = "income" | "expense";

// ISO 4217 codes. Only ILS is used for now; EUR and USD arrive with the conversion API.
export type Currency = "ILS" | "EUR" | "USD";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  categoryId: string;
  date: string; // ISO date, e.g. "2026-10-05"
  note?: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  month: string; // "YYYY-MM"
  limit: number;
  currency: Currency;
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  targetDate?: string;
};

export type InvestmentType = "stock" | "etf" | "crypto" | "bond" | "other";

export type Investment = {
  id: string;
  name: string;
  type: InvestmentType;
  ticker?: string;
  amountInvested: number;
  currentValue: number;
  currency: Currency;
  purchaseDate: string;
};

export type WishlistPriority = "low" | "medium" | "high";
export type WishlistStatus = "wanted" | "saving" | "purchased";

export type WishlistItem = {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  priority: WishlistPriority;
  status: WishlistStatus;
  url?: string;
  notes?: string;
};
