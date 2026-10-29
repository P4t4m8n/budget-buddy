import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import AddTransactionDialog from "@/components/transactions/AddTransactionDialog";
import TransactionsTable from "@/components/transactions/TransactionsTable";
import { categories, transactions } from "@/lib/mock-data";

export default function TransactionsPage() {
  const rows = transactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    currency: t.currency,
    type: t.type,
    categoryId: t.categoryId,
    categoryName:
      categories.find((c) => c.id === t.categoryId)?.name ?? "Unknown",
    date: t.date,
  }));

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Transactions"
          description="All your income and spending"
        />
        <AddTransactionDialog categories={categories} />
      </div>
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <TransactionsTable rows={rows} categories={categories} />
      </Suspense>
    </>
  );
}
