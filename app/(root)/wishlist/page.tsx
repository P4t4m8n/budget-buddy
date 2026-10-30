import { Suspense } from "react";
import SummaryCard from "@/components/dashboard/SummaryCard";
import PageHeader from "@/components/layout/PageHeader";
import WishlistDialog from "@/components/wishlist/WishlistDialog";
import WishlistItemCard from "@/components/wishlist/WishlistItemCard";
import { getCategories } from "@/lib/data/categories";
import { getWishlist } from "@/lib/data/wishlist";
import { formatCurrency } from "@/lib/format";

const grid = "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

async function WishlistContent() {
  const [{ open, purchased, openTotal, purchasedTotal }, categories] =
    await Promise.all([getWishlist(), getCategories()]);
  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  return (
    <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Still to buy" value={formatCurrency(openTotal)} />
        <SummaryCard label="Items on the list" value={String(open.length)} />
        <SummaryCard
          label="Already purchased"
          value={formatCurrency(purchasedTotal)}
          tone="positive"
        />
      </section>

      <h2 className="mt-8 mb-4 text-lg font-semibold">To buy</h2>
      {open.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-neutral-400">
          Nothing on your wishlist yet. Add something you want to buy.
        </p>
      ) : (
        <section className={grid}>
          {open.map((item) => (
            <WishlistItemCard
              key={item.id}
              item={item}
              categories={expenseCategories}
            />
          ))}
        </section>
      )}

      {purchased.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 text-lg font-semibold">Purchased</h2>
          <section className={grid}>
            {purchased.map((item) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                categories={expenseCategories}
              />
            ))}
          </section>
        </>
      )}
    </>
  );
}

export default function WishlistPage() {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Wishlist" description="Things you want to buy" />
        <WishlistDialog />
      </div>
      <Suspense
        fallback={<div className="h-96 animate-pulse rounded-xl bg-neutral-900" />}
      >
        <WishlistContent />
      </Suspense>
    </>
  );
}
