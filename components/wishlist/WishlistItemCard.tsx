// ---Components---
import DeleteWishlistItemButton from "./DeleteWishlistItemButton";
import PurchaseDialog from "./PurchaseDialog";
import WishlistDialog from "./WishlistDialog";

// ---Lib---
import { formatCurrency } from "@/lib/format";
import { wishlistPriorityLabels, wishlistStatusLabels } from "@/lib/labels";

// ---Types---
import type {
  Category,
  WishlistItem,
  WishlistPriority,
} from "@/types/finance";

const priorityStyles: Record<WishlistPriority, string> = {
  HIGH: "bg-red-500/15 text-red-400",
  MEDIUM: "bg-amber-500/15 text-amber-400",
  LOW: "bg-sky-500/15 text-sky-400",
};

export default function WishlistItemCard({
  item,
  categories,
}: {
  item: WishlistItem;
  // The user's expense categories, for recording the purchase
  categories: Category[];
}) {
  const purchased = item.status === "PURCHASED";

  return (
    <article
      aria-label={item.name}
      className="flex flex-col rounded-xl border border-white/10 bg-neutral-900 p-5"
    >
      <div className={`flex-1 ${purchased ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-semibold break-words">{item.name}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[item.priority]}`}
          >
            {wishlistPriorityLabels[item.priority]}
          </span>
        </div>
        <p className="mt-2 text-xl font-bold">
          {formatCurrency(item.price, item.currency)}
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          {wishlistStatusLabels[item.status]}
        </p>
        {item.notes && (
          <p className="mt-2 text-xs break-words text-neutral-500">
            {item.notes}
          </p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
          >
            View product
          </a>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-white/5 pt-3">
        {!purchased && (
          <>
            <PurchaseDialog item={item} categories={categories} />
            <WishlistDialog item={item} />
          </>
        )}
        <DeleteWishlistItemButton item={item} />
      </div>
    </article>
  );
}
