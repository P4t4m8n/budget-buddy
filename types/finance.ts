import type { Decimal } from "@prisma/client/runtime/client";
import type {
  Budget as DbBudget,
  Category as DbCategory,
  Investment as DbInvestment,
  InvestmentSnapshot as DbInvestmentSnapshot,
  SavingsDeposit as DbSavingsDeposit,
  SavingsGoal as DbSavingsGoal,
  Transaction as DbTransaction,
  WishlistItem as DbWishlistItem,
} from "@/generated/prisma/browser";

export {
  Currency,
  InvestmentType,
  TransactionType,
  WishlistPriority,
  WishlistStatus,
} from "@/generated/prisma/enums";

// Prisma returns Decimal and Date, which can't be passed from server to client
// components. These are the same models with Decimal -> number and Date -> ISO string.
type Serialized<T> = {
  [K in keyof T]: T[K] extends Decimal
    ? number
    : T[K] extends Decimal | null
      ? number | null
      : T[K] extends Date
        ? string
        : T[K] extends Date | null
          ? string | null
          : T[K];
};

type UiModel<T> = Serialized<Omit<T, "userId" | "createdAt">>;

export type Category = UiModel<DbCategory>;
export type Transaction = UiModel<DbTransaction>;
export type Budget = UiModel<DbBudget>;
export type SavingsGoal = UiModel<DbSavingsGoal>;
export type SavingsDeposit = UiModel<DbSavingsDeposit>;
export type Investment = UiModel<DbInvestment>;
export type InvestmentSnapshot = UiModel<DbInvestmentSnapshot>;
export type WishlistItem = UiModel<DbWishlistItem>;
