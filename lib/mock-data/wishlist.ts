import type { WishlistItem } from "@/types/finance";

export const wishlistItems: WishlistItem[] = [
  { id: "w-001", name: "Mechanical keyboard", price: 180, priority: "medium", status: "wanted", url: "https://example.com/keyboard" },
  { id: "w-002", name: "Noise-cancelling headphones", price: 350, priority: "high", status: "saving", notes: "Waiting for a sale" },
  { id: "w-003", name: "Standing desk", price: 620, priority: "high", status: "wanted" },
  { id: "w-004", name: "Espresso machine", price: 450, priority: "low", status: "wanted" },
  { id: "w-005", name: "Running shoes", price: 140, priority: "medium", status: "purchased" },
  { id: "w-006", name: "4K monitor", price: 520, priority: "medium", status: "saving" },
];
