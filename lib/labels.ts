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
