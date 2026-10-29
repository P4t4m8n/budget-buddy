import type { Currency, TransactionType } from "@/types/finance";

// A transaction as the table shows it: the stored fields plus the category's name
export type TransactionRow = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  date: string;
  note: string | null;
};
