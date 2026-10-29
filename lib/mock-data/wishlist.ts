import type { WishlistItem } from "@/types/finance";

export const wishlistItems: WishlistItem[] = [
  { id: "w-001", name: "Mechanical keyboard", price: 180, currency: "ILS", priority: "MEDIUM", status: "WANTED", url: "https://example.com/keyboard", notes: null },
  { id: "w-002", name: "Noise-cancelling headphones", price: 350, currency: "ILS", priority: "HIGH", status: "SAVING", url: null, notes: "Waiting for a sale" },
  { id: "w-003", name: "Standing desk", price: 620, currency: "ILS", priority: "HIGH", status: "WANTED", url: null, notes: null },
  { id: "w-004", name: "Espresso machine", price: 450, currency: "ILS", priority: "LOW", status: "WANTED", url: null, notes: null },
  { id: "w-005", name: "Running shoes", price: 140, currency: "ILS", priority: "MEDIUM", status: "PURCHASED", url: null, notes: null },
  { id: "w-006", name: "4K monitor", price: 520, currency: "ILS", priority: "MEDIUM", status: "SAVING", url: null, notes: null },
];
