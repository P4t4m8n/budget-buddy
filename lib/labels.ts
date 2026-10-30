import type {
  InvestmentType,
  TransactionType,
  WishlistPriority,
  WishlistStatus,
} from "@/types/finance";

export const investmentTypeLabels: Record<InvestmentType, string> = {
  STOCK: "Stock",
  ETF: "ETF",
  CRYPTO: "Crypto",
  BOND: "Bond",
  OTHER: "Other",
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// "3 transactions and 1 budget"; empty when the category isn't used
export const categoryUsageText = (transactions: number, budgets: number) => {
  return [
    transactions > 0 && plural(transactions, "transaction"),
    budgets > 0 && plural(budgets, "budget"),
  ]
    .filter(Boolean)
    .join(" and ");
};

export const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: "Income",
  EXPENSE: "Expense",
};

export const wishlistPriorityLabels: Record<WishlistPriority, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const wishlistStatusLabels: Record<WishlistStatus, string> = {
  WANTED: "Wanted",
  SAVING: "Saving for it",
  PURCHASED: "Purchased",
};
