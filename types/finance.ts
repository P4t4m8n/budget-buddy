export type TransactionType = "income" | "expense";

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
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
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
  purchaseDate: string;
};

export type WishlistPriority = "low" | "medium" | "high";
export type WishlistStatus = "wanted" | "saving" | "purchased";

export type WishlistItem = {
  id: string;
  name: string;
  price: number;
  priority: WishlistPriority;
  status: WishlistStatus;
  url?: string;
  notes?: string;
};
