import { formatCurrency } from "@/lib/format";
import type {
  WishlistItem,
  WishlistPriority,
  WishlistStatus,
} from "@/types/finance";

const priorityStyles: Record<WishlistPriority, string> = {
  high: "bg-red-500/15 text-red-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-sky-500/15 text-sky-400",
};

const statusLabels: Record<WishlistStatus, string> = {
  wanted: "Wanted",
  saving: "Saving for it",
  purchased: "Purchased",
};

export default function WishlistItemCard({ item }: { item: WishlistItem }) {
  return (
    <div
      className={`rounded-xl border border-white/10 bg-neutral-900 p-5 ${
        item.status === "purchased" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{item.name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${priorityStyles[item.priority]}`}
        >
          {item.priority}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold">
        {formatCurrency(item.price, item.currency)}
      </p>
      <p className="mt-1 text-sm text-neutral-400">
        {statusLabels[item.status]}
      </p>
      {item.notes && (
        <p className="mt-2 text-xs text-neutral-500">{item.notes}</p>
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
  );
}
