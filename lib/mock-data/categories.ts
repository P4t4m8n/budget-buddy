import type { Category } from "@/types/finance";

export const categories: Category[] = [
  { id: "cat-salary", name: "Salary", type: "income", color: "#10b981" },
  { id: "cat-freelance", name: "Freelance", type: "income", color: "#22c55e" },
  { id: "cat-other-income", name: "Other income", type: "income", color: "#84cc16" },
  { id: "cat-rent", name: "Rent", type: "expense", color: "#6366f1" },
  { id: "cat-groceries", name: "Groceries", type: "expense", color: "#f59e0b" },
  { id: "cat-transport", name: "Transport", type: "expense", color: "#0ea5e9" },
  { id: "cat-utilities", name: "Utilities", type: "expense", color: "#14b8a6" },
  { id: "cat-dining", name: "Dining out", type: "expense", color: "#ef4444" },
  { id: "cat-entertainment", name: "Entertainment", type: "expense", color: "#ec4899" },
  { id: "cat-health", name: "Health", type: "expense", color: "#a855f7" },
  { id: "cat-shopping", name: "Shopping", type: "expense", color: "#f97316" },
];
