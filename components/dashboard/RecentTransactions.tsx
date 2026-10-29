import type { Category, Transaction } from "@/types/finance";
import { formatCurrency } from "@/lib/format";

export default function RecentTransactions({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Unknown";

  return (
    <ul className="divide-y divide-white/10">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">{t.description}</p>
            <p className="text-xs text-neutral-400">
              {categoryName(t.categoryId)} · {t.date}
            </p>
          </div>
          <span
            className={`text-sm font-semibold ${
              t.type === "income" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {t.type === "income" ? "+" : "-"}
            {formatCurrency(t.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
