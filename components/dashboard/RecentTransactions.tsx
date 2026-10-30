import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { RecentTransaction } from "@/types/dashboard";

export default function RecentTransactions({
  transactions,
}: {
  transactions: RecentTransaction[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="py-3 text-sm text-neutral-400">
        No transactions yet.{" "}
        <Link href="/transactions" className="text-emerald-400 hover:underline">
          Add your first one on the Transactions page.
        </Link>
      </p>
    );
  }

  return (
    <ul className="divide-y divide-white/10">
      {transactions.map((t) => (
        <li key={t.id} className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium">{t.description}</p>
            <p className="text-xs text-neutral-400">
              {t.categoryName} · {t.date}
            </p>
          </div>
          <span
            className={`text-sm font-semibold ${
              t.type === "INCOME" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {t.type === "INCOME" ? "+" : "-"}
            {formatCurrency(t.amount, t.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}
