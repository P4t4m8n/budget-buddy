import { Suspense } from "react";
import PageHeader from "@/components/layout/PageHeader";
import TransactionsTable from "@/components/transactions/TransactionsTable";
import { getCategories } from "@/lib/data/categories";
import { getTransactions } from "@/lib/data/transactions";

async function TransactionsContent() {
  const [transactions, categories] = await Promise.all([
    getTransactions(),
    getCategories(),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const rows = transactions.map((t) => ({
    ...t,
    categoryName: categoryNames.get(t.categoryId) ?? "Unknown",
  }));

  return <TransactionsTable rows={rows} categories={categories} />;
}

export default function TransactionsPage() {
  return (
    <>
      <PageHeader
        title="Transactions"
        description="All your income and spending"
      />
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <TransactionsContent />
      </Suspense>
    </>
  );
}
