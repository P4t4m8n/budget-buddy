import SummaryCard from "@/components/dashboard/SummaryCard";
import PageHeader from "@/components/layout/PageHeader";
import AddWishlistItemDialog from "@/components/wishlist/AddWishlistItemDialog";
import WishlistItemCard from "@/components/wishlist/WishlistItemCard";
import { formatCurrency } from "@/lib/format";
import { wishlistItems } from "@/lib/mock-data";

const sum = (values: number[]) => values.reduce((total, v) => total + v, 0);

export default function WishlistPage() {
  const open = wishlistItems.filter((i) => i.status !== "PURCHASED");
  const purchased = wishlistItems.filter((i) => i.status === "PURCHASED");
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sortedOpen = [...open].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Wishlist" description="Things you want to buy" />
        <AddWishlistItemDialog />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Still to buy"
          value={formatCurrency(sum(open.map((i) => i.price)))}
        />
        <SummaryCard
          label="Items on the list"
          value={String(open.length)}
        />
        <SummaryCard
          label="Already purchased"
          value={formatCurrency(sum(purchased.map((i) => i.price)))}
          tone="positive"
        />
      </section>

      <h2 className="mt-8 mb-4 text-lg font-semibold">To buy</h2>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedOpen.map((item) => (
          <WishlistItemCard key={item.id} item={item} />
        ))}
      </section>

      {purchased.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 text-lg font-semibold">Purchased</h2>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {purchased.map((item) => (
              <WishlistItemCard key={item.id} item={item} />
            ))}
          </section>
        </>
      )}
    </>
  );
}
