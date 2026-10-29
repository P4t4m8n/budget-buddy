import type { Category } from "@/types/finance";

export const categories: Category[] = [
  { id: "cat-salary", name: "Salary", type: "INCOME", color: "#10b981" },
  { id: "cat-freelance", name: "Freelance", type: "INCOME", color: "#22c55e" },
  { id: "cat-other-income", name: "Other income", type: "INCOME", color: "#84cc16" },
  { id: "cat-rent", name: "Rent", type: "EXPENSE", color: "#6366f1" },
  { id: "cat-groceries", name: "Groceries", type: "EXPENSE", color: "#f59e0b" },
  { id: "cat-transport", name: "Transport", type: "EXPENSE", color: "#0ea5e9" },
  { id: "cat-utilities", name: "Utilities", type: "EXPENSE", color: "#14b8a6" },
  { id: "cat-dining", name: "Dining out", type: "EXPENSE", color: "#ef4444" },
  { id: "cat-entertainment", name: "Entertainment", type: "EXPENSE", color: "#ec4899" },
  { id: "cat-health", name: "Health", type: "EXPENSE", color: "#a855f7" },
  { id: "cat-shopping", name: "Shopping", type: "EXPENSE", color: "#f97316" },
];
